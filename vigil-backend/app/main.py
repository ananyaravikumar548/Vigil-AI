import asyncio
import os
import random
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import engine, Base, SessionLocal
from app.models.patient import PatientModel
from app.routers import patients, simulation, orders, model_info
from app.seed import seed_if_empty

Base.metadata.create_all(bind=engine)


def _allowed_origins() -> list[str]:
    """CORS origins from ALLOWED_ORIGINS; defaults to local dev origins only."""
    raw = os.getenv("ALLOWED_ORIGINS", "")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if origins:
        return origins
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


app = FastAPI(title="Vigil AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(simulation.router)
app.include_router(orders.router)
app.include_router(model_info.router)

try:
    seeded = seed_if_empty()
    if seeded:
        print(f"Seeded {seeded} demo patients into an empty database.")
except Exception as exc:  # pragma: no cover - startup convenience only
    print(f"Demo seed skipped: {exc}")


@app.get("/")
def root():
    return {"status": "Vigil AI backend running", "docs": "/docs"}


@app.get("/health")
def health_check():
    """Status of the service, the trained model, and the narration provider."""
    from app.ml_engine import model_loader
    from app.llm import narrator

    api_key = os.getenv("GROQ_API_KEY")
    groq_configured = bool(api_key and api_key != "your-groq-api-key-here")
    db = SessionLocal()
    try:
        patient_count = db.query(PatientModel).count()
    finally:
        db.close()
    return {
        "status": "ok",
        "service": "Vigil AI backend",
        "model_loaded": bool(getattr(model_loader, "model", None) is not None),
        "model_path_exists": os.path.exists(model_loader.MODEL_PATH),
        "model_features": list(model_loader.FEATURE_NAMES),
        "calibrator_loaded": model_loader.calibrator is not None,
        "groq_api_key_configured": groq_configured,
        "narration_model": narrator.narration_model_name(),
        "demo_patient_count": patient_count,
    }


@app.websocket("/ws/telemetry/{patient_id}")
async def telemetry_websocket(websocket: WebSocket, patient_id: str):
    await websocket.accept()

    db: Session = SessionLocal()
    patient = db.query(PatientModel).filter(PatientModel.id == patient_id).first()
    db.close()

    if not patient:
        await websocket.send_json({"error": f"Unknown patient_id '{patient_id}'"})
        await websocket.close()
        return

    try:
        while True:
            # Jitter around this patient's REAL stored vitals, not
            # disconnected random numbers — makes the "live monitor"
            # feel tied to the actual patient being viewed.
            payload = {
                "patient_id": patient_id,
                "hr": round(patient.hr + random.uniform(-2, 2), 1),
                "map": round(patient.map + random.uniform(-1.5, 1.5), 1),
                "o2sat": round(min(100, patient.o2sat + random.uniform(-0.5, 0.5)), 1),
                "resp": round(patient.resp + random.uniform(-1, 1), 1),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await websocket.send_json(payload)
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        pass
