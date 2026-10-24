# Vigil frontend

React, TypeScript, and Vite interface for the Vigil local API demo.

## Run locally

Start the FastAPI service first by following [`../vigil-backend/README.md`](../vigil-backend/README.md), then run:

```bash
cd vigil-frontend
npm install
npm run dev
```

Open `http://localhost:3000`. `VITE_API_BASE_URL` defaults to `http://localhost:8000/api`.

## Judge walkthrough

1. Open **Patient queue** and select a seeded patient. Compare patients to see that their backend estimates and explanations differ.
2. Review the model estimate, SHAP contributions, and narration on **Explain**.
3. Open **What-if**, move a real model-feature slider, and review the updated estimate returned by `/api/simulate`.
4. Select one or more workflow placeholders in **Sandbox receipt**, preview the exact local API request, submit it, and inspect the returned SHA-256 content hash.

The patient records and model are for demonstration only. The scenario feature changes are not treatment effects. The bundle endpoint does not transmit or execute clinical orders. If the API is offline, the interface marks any sample fallback data visibly.

## Checks

```bash
npm run lint
npm run build
```
