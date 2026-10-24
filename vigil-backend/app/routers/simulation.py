from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.patient import PatientModel
from app.ml_engine.shap_explainer import get_risk_and_explanation
from app.ml_engine.model_loader import FEATURE_NAMES

router = APIRouter(prefix="/api/simulate", tags=["Counterfactual Simulation"])


class SimulationInput(BaseModel):
    patient_id: str
    # Optional overrides for any subset of the model's real features.
    # e.g. {"Lactate": 1.1, "MAP": 75.0} simulates "what if these were different"
    overrides: dict[str, float] = Field(default_factory=dict)


@router.post("")
def run_counterfactual(data: SimulationInput, db: Session = Depends(get_db)):
    patient = db.query(PatientModel).filter(PatientModel.id == data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"No patient found with id '{data.patient_id}'")

    baseline_vector = [getattr(patient, f.lower()) for f in FEATURE_NAMES]
    baseline_risk, baseline_contributions = get_risk_and_explanation(baseline_vector)

    # Apply the user's overrides on top of the patient's real values —
    # this re-runs the ACTUAL trained model on the modified input, so the
    # resulting change in risk is genuinely computed, not a fake formula.
    simulated_vector = list(baseline_vector)
    unknown_features = [k for k in data.overrides if k not in FEATURE_NAMES]
    if unknown_features:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown feature(s) {unknown_features}. Valid features: {FEATURE_NAMES}",
        )
    for feature_name, new_value in data.overrides.items():
        idx = FEATURE_NAMES.index(feature_name)
        simulated_vector[idx] = new_value

    simulated_risk, simulated_contributions = get_risk_and_explanation(simulated_vector)

    return {
        "patient_id": data.patient_id,
        "baseline_risk_percentage": round(baseline_risk * 100, 1),
        "simulated_risk_percentage": round(simulated_risk * 100, 1),
        "risk_change_percentage_points": round((simulated_risk - baseline_risk) * 100, 1),
        "overrides_applied": data.overrides,
        "simulated_contributions": simulated_contributions,
    }
