"""Generate and persist one Groq narration for each fictional demo patient."""

from pathlib import Path
import sys

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT / ".env")

from app.database import SessionLocal  # noqa: E402
from app.llm.narrator import cached_narration_entries, narrate_risk  # noqa: E402
from app.ml_engine.model_loader import FEATURE_NAMES  # noqa: E402
from app.ml_engine.shap_explainer import get_risk_and_explanation  # noqa: E402
from app.models.patient import PatientModel  # noqa: E402


DEMO_PATIENT_IDS = ["MICU-402", "ICU-207", "ICU-311", "MICU-114"]


def main() -> None:
    db = SessionLocal()
    try:
        for patient_id in DEMO_PATIENT_IDS:
            patient = db.query(PatientModel).filter(PatientModel.id == patient_id).first()
            if patient is None:
                raise SystemExit(f"Missing demo patient: {patient_id}; seed the backend database first.")
            feature_values = [getattr(patient, feature.lower()) for feature in FEATURE_NAMES]
            risk, contributions = get_risk_and_explanation(feature_values)
            result = narrate_risk(
                patient.id,
                patient.name,
                risk,
                contributions,
                feature_values,
                "pregeneration-script",
                force_live=True,
            )
            if result["source"] != "live":
                raise SystemExit(f"Groq did not return a complete narration for {patient_id}; cache was not generated for that patient.")
            print(f"{patient_id}: {result['text']}")
            entry = next(value for value in cached_narration_entries().values() if value["patient_id"] == patient_id)
            print(f"  cache key: {entry['cache_key']}")
            print(f"  model: {entry['model']} · generated_at: {entry['generated_at']}")
    finally:
        db.close()

    entries = cached_narration_entries()
    print(f"\nCache file: {BACKEND_ROOT / 'app/llm/narration_cache.json'}")
    print(f"Total cached entries: {len(entries)}")
    for patient_id in DEMO_PATIENT_IDS:
        matching = [entry for entry in entries.values() if entry.get("patient_id") == patient_id]
        print(f"{patient_id}: {len(matching)} cached narration(s)")


if __name__ == "__main__":
    main()
