import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models.patient import PatientModel
from app.ml_engine.shap_explainer import get_risk_and_explanation
from app.ml_engine.model_loader import FEATURE_NAMES

def main():
    db = SessionLocal()
    patients = db.query(PatientModel).all()
    patient_dict = {p.id: p for p in patients}

    order = ["MICU-402", "ICU-207", "ICU-311", "MICU-114"]
    for pid in order:
        p = patient_dict[pid]
        feats = [getattr(p, f.lower()) for f in FEATURE_NAMES]
        risk, contribs = get_risk_and_explanation(feats)
        top3 = contribs[:3]
        print(f"=== {p.id} ({p.name}) ===")
        print(f"Risk Score: {risk * 100:.1f}%")
        for c in top3:
            feat = c['feature']
            val = c['value']
            direct = c['direction']
            impact = c['shap_impact']
            print(f"  - {feat} = {val}: {direct} (impact: {impact:+.4f})")
        print()
    db.close()

if __name__ == "__main__":
    main()
