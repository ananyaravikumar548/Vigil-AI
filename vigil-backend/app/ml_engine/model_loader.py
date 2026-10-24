import os
import json
import joblib
import xgboost as xgb

_HERE = os.path.dirname(__file__)
MODEL_PATH = os.path.join(_HERE, "sepsis_model.json")
FEATURES_PATH = os.path.join(_HERE, "features.json")
CALIBRATOR_PATH = os.path.join(_HERE, "calibrator.joblib")

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"No trained model found at {MODEL_PATH}. "
        f"Run scripts/preprocess.py then scripts/train_model.py first."
    )

model = xgb.XGBClassifier()
model.load_model(MODEL_PATH)

calibrator = None
if os.path.exists(CALIBRATOR_PATH):
    try:
        calibrator = joblib.load(CALIBRATOR_PATH)
    except Exception:
        calibrator = None

with open(FEATURES_PATH) as f:
    FEATURE_NAMES = json.load(f)
