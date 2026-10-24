# Vigil AI — One-Pager

**Problem.** Sepsis is time-critical: every hour of delayed treatment increases mortality. Clinicians need early, patient-specific risk signals, but black-box scores offer no insight into *why* a patient is flagged, making them hard to trust or act on.

**Solution.** Vigil AI is an explainable sepsis-risk decision-support prototype for the ICU. It trains an XGBoost model on PhysioNet 2019 de-identified ICU data, computes a per-patient risk estimate, and explains it with SHAP feature attribution — showing exactly which vitals and labs drove the estimate, and in which direction.

**Key features.**

- **Patient queue:** Live list of seeded ICU patients with backend-computed risk scores.
- **Risk attribution:** Sepsis risk percentage plus a sorted SHAP waterfall (red = increases risk, green = decreases risk), each feature shown with its observed value.
- **Model narration:** LLM-generated plain-language summary of the top risk factors (Groq); degrades gracefully to a template summary when the API key is unavailable.
- **Counterfactual what-if:** Adjust any model feature (lactate, MAP, HR, resp, temp, O2Sat, WBC, platelets, creatinine, HCO3, BUN, glucose, bilirubin) and receive a re-computed risk estimate from the backend — no client-side formula.
- **Sandbox order bundle:** Select demo workflow items, submit to a local endpoint, and receive a SHA-256 content hash and timestamp. Clearly labeled as simulated — no real EHR/FHIR transmission or digital signature.
- **Telemetry:** Per-patient simulated vital stream with live/offline indicator.

**How it works.** One leakage-aware snapshot per patient: sepsis cases use their first positive warning hour; controls are matched to the cases' ICU-stay distribution so the model cannot learn time-in-ICU. `ICULOS` is not a feature. The train/validation/test split is patient-disjoint and stratified; the decision threshold is tuned on validation only and applied to the held-out test split. Monotone constraints encode clinical priors: risk rises with lactate, resp, HR, WBC, creatinine, temperature; falls with MAP, O2Sat, platelets.

<!-- AUTO_METRICS_START -->
**Real metrics (holdout).** 5,656 patients (466 cases, 8.24% overall positive). AUROC 0.7547, average precision 0.2682 vs 8.22% holdout prevalence, Brier score 0.0684. The decision threshold is 0.20 (validation-tuned); confusion counts: TN 978, FP 61, FN 64, TP 29.
<!-- AUTO_METRICS_END -->

**Limitations.** Single-snapshot features, not time-series. Training on a PhysioNet subset. Demo patients are hand-built fiction, not real people. Narration is an LLM output. No clinical validation. **Research prototype — not for diagnosis or treatment.**

**Future work.** Temporal modeling, external validation, calibration for bedside use, clinician-in-the-loop threshold tuning.
