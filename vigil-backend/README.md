# Vigil backend

FastAPI demo service for patient-specific sepsis-risk estimates, SHAP feature contributions, feature scenarios, and a simulated order-bundle receipt.

## Data and model limits

`data/raw/*.psv` contains local copies of the PhysioNet/CinC Challenge 2019 training-set patient timelines (sets A and B). The raw files are ignored by Git and should not be committed. Follow the dataset's access and use terms when obtaining or sharing copies: [PhysioNet Challenge 2019](https://physionet.org/content/challenge-2019/1.0.0/).

Preprocessing creates one snapshot per patient. A patient with a positive `SepsisLabel` uses their first positive warning-hour snapshot; a patient with no positive label uses a control snapshot drawn from the cases' `ICULOS` distribution, so the model cannot learn time-in-ICU. Feature values are forward-filled only, so later measurements are not copied into earlier snapshots. Missing values remain missing and are handled by XGBoost. `ICULOS` is not a model feature and is never returned by the API or shown in the UI. Training reports patient-disjoint holdout AUROC, average precision, Brier score, and threshold metrics in `app/ml_engine/metrics.json` (the file the API serves at `GET /api/model-info`).

This is an exploratory benchmark, not clinical validation. Cases and controls use different snapshot-selection rules, and model probabilities are not calibrated for bedside use. The frontend's named patients are fictional demo profiles, not patients from the PhysioNet files. Do not use model estimates for patient care or describe them as proven clinical performance.

The model is trained on a limited dataset, and individual feature attributions can be clinically implausible. For example, Eleanor's elevated creatinine (1.5 mg/dL) and low bicarbonate (18 mmol/L) decrease this model's estimate. SHAP describes model behavior, not clinical causality.

## Run locally

Python 3.12 is the supported local and deployment runtime (`.python-version` and
`runtime.txt`). Demo patient records are hand-built fictional profiles, not
patients from the training dataset.

```bash
cd vigil-backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Optional: create .env from .env.example and add GROQ_API_KEY to enable narration.
# Without it, the API returns a fallback note.

python scripts/preprocess.py
python scripts/train_model.py
python scripts/seed_db.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for the API reference. The database is created automatically on first start and seeded with the demo records when it is empty. Run `scripts/seed_db.py` to add or refresh the four fictional demo profiles.

## API used by the frontend

- `GET /health` — service status, whether the trained model is loaded, and whether `GROQ_API_KEY` is configured
- `GET /api/model-info` — the contents of `app/ml_engine/metrics.json` (dataset, patient count, AUROC, average precision, Brier score)
- `GET /api/patients` — list seeded demo patients
- `GET /api/patients/{id}?narrate=true` — patient details, model estimate, SHAP contributions, and optional narration
- `POST /api/simulate` — rerun the model with overrides for `Lactate`, `MAP`, `HR`, `Resp`, `Temp`, `O2Sat`, `WBC`, `Platelets`, or `Creatinine`
- `POST /api/orders/sign-and-transmit` — record selected demo strings and return a SHA-256 content hash; this is a local simulation, not a real EHR/FHIR transmission or a digital signature
- `WS /ws/telemetry/{patient_id}` — demo telemetry stream based on seeded values

The frontend dev server runs at `http://localhost:3000`. CORS origins come from the `ALLOWED_ORIGINS` environment variable (comma-separated) and default to the local dev origins only — there is no wildcard. Set `ALLOWED_ORIGINS` to the deployed frontend URL before deploying.

If `data/raw` is empty, download data only after satisfying the dataset's terms. The bulk downloader is `scripts/download_dataset.py`; run `python scripts/download_dataset.py --help` for options. `scripts/generate_test_data.py` is only for a separate synthetic smoke-test dataset and should not be mixed with the PhysioNet files when reporting model performance.

## Narration

Narration uses Groq when `GROQ_API_KEY` is configured. `GROQ_MODEL` defaults to
`openai/gpt-oss-120b`. If narration fails, the API returns a deterministic
template summary while keeping the backend risk estimate and SHAP contributions
available. The UI labels this as “Template summary (LLM unavailable).” Keep
`.env` local and do not commit API keys.

AI narration is cached and rate-limited to protect the API quota. Cache keys are
specific to the patient, model, ordered feature values, and prompt version.
`MAX_LIVE_NARRATIONS_PER_IP_PER_DAY` defaults to `6`, and
`MAX_LIVE_NARRATIONS_PER_DAY` defaults to `50`; both counters reset at UTC
midnight. Cache hits do not consume quota. To refresh the four committed demo
summaries intentionally, run `python scripts/pregenerate_narrations.py` with a
configured Groq key. The script makes one live request per demo patient.

## Deployment

`Procfile` starts the service with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. The model artifacts in `app/ml_engine/` (`sepsis_model.json`, `calibrator.joblib`, `features.json`, `metrics.json`) must be deployed with the code — the service refuses to start without `sepsis_model.json`. Set `GROQ_API_KEY` and `ALLOWED_ORIGINS` in the platform dashboard.
