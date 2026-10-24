# Vigil AI

Explainable ICU sepsis-risk decision-support prototype for DSH Hacks V2 (theme: AI x Healthcare).

## What it is

Vigil is a research prototype that estimates patient-specific sepsis risk from ICU vital signs and lab values, explains each estimate with SHAP feature attribution, and lets clinicians explore "what-if" feature scenarios through a live backend API. It is **not** clinically validated, **not** a diagnosis, and **must not** guide patient care.

## Repo layout

```
vigil/
├── vigil-backend/          # FastAPI service, XGBoost + SHAP model, SQLite, Groq narration
├── vigil-frontend/         # React + Vite + TypeScript UI
└── docs/                   # one_pager.md, demo_script.md, code.txt
```

## Stack

**Backend:** FastAPI, Uvicorn, XGBoost, SHAP, scikit-learn, SQLAlchemy (SQLite), Groq (LLM narration), python-dotenv  
**Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, Motion  
**Data:** PhysioNet/CinC Challenge 2019 (de-identified ICU time series), one leakage-aware snapshot per patient

**Submission links:** TODO — add the public repository URL after publishing.
TODO — add the live demo URL after deployment.

## Real metrics (holdout test split)

<!-- AUTO_METRICS_START -->
| Metric | Value |
|---|---|
| Patients used | 5,656 (466 sepsis cases, 5,190 controls) |
| Train / test | 4,524 / 1,132 (patient-disjoint, stratified; train includes validation) |
| AUROC | 0.7547 |
| Average precision | 0.2682 (holdout prevalence: 8.22%) |
| Brier score | 0.0684 |
| Calibration | sigmoid (Platt scaling) |
| Decision threshold | 0.20 (tuned on validation split) |
| Holdout confusion counts | TN 978, FP 61, FN 64, TP 29 |
<!-- AUTO_METRICS_END -->

AUROC is well below 0.90, so no feature-leakage warning fired. `ICULOS` (time-in-ICU) is **not** a model feature and is never returned by the API or shown in the UI.

## Local run

```bash
# Backend
cd vigil-backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Optional: create .env from .env.example and add GROQ_API_KEY to enable narration
cp .env.example .env

# Process data, train model, seed demo patients
python scripts/preprocess.py
python scripts/train_model.py
python scripts/seed_db.py

# Start API
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for the API reference.

```bash
# Frontend (separate terminal)
cd vigil-frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## API endpoints

- `GET /health` — service status, model loaded, Groq key configured
- `GET /api/model-info` — training metrics from `app/ml_engine/metrics.json`
- `GET /api/patients` — 4 seeded demo patients
- `GET /api/patients/{id}?narrate=true` — risk, vitals, SHAP contributions, narration
- `POST /api/simulate` — feature override → re-computed model risk
- `POST /api/orders/sign-and-transmit` — simulated sandbox receipt (SHA-256 hash, not a real EHR/FHIR transmission or digital signature)
- `WS /ws/telemetry/{patient_id}` — simulated telemetry stream (jitter around stored seeded vitals)

AI narration is cached and rate-limited to protect the API quota. Configure
`MAX_LIVE_NARRATIONS_PER_IP_PER_DAY` (default `6`) and
`MAX_LIVE_NARRATIONS_PER_DAY` (default `50`) in `vigil-backend/.env` to adjust
the daily fresh-call limits; cache hits do not consume those limits.

## Data

`vigil-backend/data/raw/` contains PhysioNet 2019 `.psv` files. These are **gitignored** and must be obtained separately under PhysioNet's terms of use. `scripts/download_physionet.py` can help after you satisfy the dataset's access requirements. `scripts/generate_test_data.py` produces synthetic smoke-test data only and must not be mixed with PhysioNet files.

## Demo patients

The 4 seeded patients are **hand-built fictional profiles**, not real people:

| Patient | Risk | Presentation |
|---|---|---|
| MICU-402 Eleanor Vance | Read current estimate in app | Suspected urosepsis — high lactate, low MAP, high respiratory rate |
| ICU-207 Priya Nair | Read current estimate in app | Community-acquired pneumonia — moderately abnormal vitals |
| ICU-311 James O'Connor | Read current estimate in app | Trauma/MVA — comparatively stable vitals |
| MICU-114 Marcus Webb | Read current estimate in app | Post-op hip replacement — comparatively stable vitals |

These demo patients are hand-built fictional profiles, not real patients or
records taken from PhysioNet. Their displayed scores are computed by the current
backend model and may change when the model is retrained.

## Honest limitations

- Single-snapshot features (one hour per patient), not time-series modeling
- Training on a subset of PhysioNet sets A+B (limited by locally available files)
- Demo patients are synthetic, hand-built profiles
- Model probabilities are calibrated for research, not bedside use
- Small-data model; individual attributions can be clinically implausible. For example, Eleanor’s elevated creatinine (1.5 mg/dL) and low bicarbonate (18 mmol/L) decrease this model’s estimate. SHAP describes model behavior, not clinical causality.
- Narration is an LLM output (Groq); falls back to a template summary when unavailable
- Order endpoint is a local sandbox simulation (SHA-256 hash), not a real EHR/FHIR transmission or digital signature
- **Not clinically validated. Not for diagnosis or treatment decisions.**

## Deployment

`vigil-backend/Procfile` runs `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Deploy backend (Render/Railway) with `GROQ_API_KEY` and `ALLOWED_ORIGINS` set. Deploy frontend (Vercel/Netlify) with `VITE_API_BASE_URL` pointing to the backend. Model artifacts (`sepsis_model.json`, `calibrator.joblib`, `features.json`, `metrics.json`) must be deployed with the code.
