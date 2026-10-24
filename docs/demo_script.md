# Vigil AI — Demo Script

**Target length:** ~2.5 minutes

**Submission links:** TODO — add the public repository URL after publishing.
TODO — add the live demo URL after deployment.

---

**[0:00–0:20] Open with the problem**

"Every hour of delayed sepsis treatment increases mortality. Clinicians need early risk signals — but black-box scores don't tell you *why* a patient is at risk, so they're hard to trust. Vigil AI is an explainable sepsis-risk prototype: it shows not just the risk percentage, but exactly which vitals and labs drove it, in which direction."

**[0:20–0:45] Patient queue**

Open the live queue at `localhost:3000`. Four hand-built fictional demo patients appear, each with a backend-computed risk score. Read the current values from the screen; do not quote saved numbers from this script.

Scores are computed by the FastAPI backend on `localhost:8000`, not hardcoded. A green dot indicates the backend is connected.

**[0:45–1:20] Risk attribution (Explain screen)**

Select Eleanor Vance. The screen shows the current model risk estimate and a SHAP waterfall with the leading risk-increasing and risk-decreasing factors. Read the displayed values and factors from the screen; they can change after retraining. Narration uses the configured Groq model or shows the label “Template summary (LLM unavailable)” when narration falls back.

Point out: every number comes from the trained XGBoost model via SHAP. No client-side formula.

**[1:20–1:50] Counterfactual what-if**

Change a feature such as lactate or MAP. The screen sends the override to `POST /api/simulate` and the backend returns a new model estimate. Read the current scenario change from the screen; it is not a treatment-effect prediction.

Say: "These are real model re-computations, not a fake formula. The slider bounds are illustrative reference ranges. This does not estimate treatment effects."

**[1:50–2:10] Sandbox order bundle**

Select one or more demo workflow items (e.g. "Review backend model estimate", "Discuss SHAP explanation with reviewer"). Submit. The backend returns `SIMULATED_TRANSMISSION_TO_SANDBOX_FHIR`, a timestamp, and a SHA-256 content hash.

Say: "This is a local sandbox simulation only. No real EHR or FHIR service is contacted. The SHA-256 hash is a content integrity hash — not a digital signature."

**[2:10–2:20] Telemetry**

Show the WS Live indicator in the patient header. The backend jitters around the patient's stored seeded vitals every ~2 seconds. Unknown patient IDs are handled without crashing.

**[2:20–2:30] Model info panel**

Open the Model Info panel on the Explain screen. It reads `GET /api/model-info` directly from the backend. Read the current patient count, holdout metrics, threshold, and features from the panel; do not quote fixed metrics from this script. Label: “Research prototype.”
<!-- AUTO_METRICS_START -->
Synced holdout metrics: 5,656 patients, 466 positives, AUROC 0.7547, AP 0.2682, Brier 0.0684, threshold 0.20, confusion counts TN 978, FP 61, FN 64, TP 29. Read the values from the live panel.
<!-- AUTO_METRICS_END -->

**[2:30–2:45] Honest limitations**

Close with the disclaimer:

"This is a research prototype, not a clinical product. It uses single-snapshot features, a PhysioNet subset, and hand-built fictional demo patients. Narration can fall back to a template, and order submission is simulated. The displayed AUROC is a holdout benchmark, not bedside validation. This is not for diagnosis or treatment decisions."

**[2:45–2:50] Outro**

"Code: github.com/… — Live demo: … — Questions welcome."
