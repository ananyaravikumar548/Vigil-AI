import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.patient import PatientModel
from app.ml_engine.shap_explainer import get_risk_and_explanation
from app.ml_engine.model_loader import FEATURE_NAMES
from app.llm.narrator import narrate_risk, narration_status

router = APIRouter(prefix="/api/patients", tags=["Patients"])
logger = logging.getLogger(__name__)


@router.get("")
def list_patients(db: Session = Depends(get_db)):
    patients = db.query(PatientModel).all()
    return [{"id": p.id, "name": p.name, "bed": p.bed, "primary_dx": p.primary_dx} for p in patients]


@router.get("/{patient_id}")
def get_patient(patient_id: str, request: Request, db: Session = Depends(get_db), narrate: bool = True):
    patient = db.query(PatientModel).filter(PatientModel.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"No patient found with id '{patient_id}'")

    # FEATURE_NAMES are e.g. ["HR", "MAP", ...] — DB columns are lowercase
    feature_vector = [getattr(patient, f.lower()) for f in FEATURE_NAMES]

    if any(v is None for v in feature_vector):
        raise HTTPException(status_code=422, detail="Patient record is missing required vitals/labs")

    risk_prob, contributions = get_risk_and_explanation(feature_vector)

    explanation = None
    narration_model = None
    narration_source = None
    narration_generated_at = None
    client_ip = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    if not client_ip:
        client_ip = request.client.host if request.client else "unknown"
    status = narration_status(client_ip)
    if narrate:
        try:
            narration = narrate_risk(
                patient.id,
                patient.name,
                risk_prob,
                contributions,
                feature_vector,
                client_ip,
            )
            explanation = narration["text"]
            narration_model = narration["model"]
            narration_source = narration["source"]
            narration_generated_at = narration["generated_at"]
            status = narration
        except Exception as e:
            # Don't let a narration failure break the whole endpoint —
            # the real risk score and SHAP data are still valid without it.
            logger.warning("Groq narration unavailable: %s", e)
            logger.warning("Narration failure type=%s", type(e).__name__)
            explanation = "AI narration is unavailable. The backend risk estimate and SHAP contributions are still available for review."
            narration_model = "Template summary (LLM unavailable)"
            narration_source = "template"

    return {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "bed": patient.bed,
        "primary_dx": patient.primary_dx,
        "vitals": {name: getattr(patient, name.lower()) for name in FEATURE_NAMES},
        "sepsis_risk_percentage": round(risk_prob * 100, 1),
        "shap_contributions": contributions,
        "ai_narration": explanation,
        "narration_provider": "Groq" if narration_source in {"live", "cached"} else None,
        "narration_model": narration_model,
        "narration_source": narration_source,
        "narration_generated_at": narration_generated_at,
        "live_narrations_remaining": status["live_narrations_remaining"],
        "live_narrations_limit": status["live_narrations_limit"],
        "narration_limit_reached": status.get("narration_limit_reached", False),
    }
