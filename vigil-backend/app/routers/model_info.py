import json
import os

from fastapi import APIRouter

from app.ml_engine.model_loader import MODEL_PATH, FEATURE_NAMES

router = APIRouter(tags=["Model"])

METRICS_PATH = os.path.join(os.path.dirname(MODEL_PATH), "metrics.json")


def load_metrics() -> dict:
    with open(METRICS_PATH) as f:
        return json.load(f)


@router.get("/api/model-info")
def get_model_info():
    """Serve the metrics recorded by scripts/train_model.py."""
    return load_metrics()
