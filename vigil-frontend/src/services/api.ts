const DEFAULT_API_BASE_URL = 'http://localhost:8000/api';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

export interface BackendPatientSummary {
  id: string;
  name: string;
  bed: string;
  primary_dx: string;
}

export interface FeatureContribution {
  feature: string;
  value: number;
  shap_impact: number;
  direction: 'increases_risk' | 'decreases_risk';
}

export interface BackendPatientDetail extends BackendPatientSummary {
  age: number;
  gender: string;
  vitals: Record<string, number>;
  sepsis_risk_percentage: number;
  shap_contributions: FeatureContribution[];
  ai_narration: string | null;
  narration_model: string | null;
  narration_source: 'live' | 'cached' | 'template' | null;
  narration_generated_at: string | null;
  live_narrations_remaining: number;
  live_narrations_limit: number;
  narration_limit_reached: boolean;
}

export interface SimulationResult {
  patient_id: string;
  baseline_risk_percentage: number;
  simulated_risk_percentage: number;
  risk_change_percentage_points: number;
  overrides_applied: Record<string, number>;
  simulated_contributions: FeatureContribution[];
}

export interface SignOrderPayload {
  patient_id: string;
  clinician_name: string;
  selected_orders: string[];
}

export interface OrderSignResponse {
  status: string;
  note: string;
  patient_id: string;
  signed_by: string;
  order_count: number;
  orders: string[];
  timestamp: string;
  integrity_signature_sha256: string;
}

export interface ModelInfo {
  dataset: string;
  n_patients_used: number;
  n_train: number;
  n_test: number;
  positives?: number;
  test_positive_count?: number;
  test_positive_rate?: number;
  auroc_ci95?: [number, number];
  positive_rate: number;
  AUROC: number;
  auroc: number;
  average_precision: number;
  brier_score: number;
  confusion_counts: { tn: number; fp: number; fn: number; tp: number };
  date: string;
  feature_list: string[];
  calibration: string;
}

export interface HealthStatus {
  status: string;
  service: string;
  model_loaded: boolean;
  model_path_exists: boolean;
  model_features: string[];
  calibrator_loaded: boolean;
  groq_api_key_configured: boolean;
  narration_model: string;
  demo_patient_count: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(7000),
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export function fetchPatients(): Promise<BackendPatientSummary[]> {
  return request('/patients');
}

export function fetchPatientRisk(id: string, narrate = true): Promise<BackendPatientDetail> {
  return request(`/patients/${encodeURIComponent(id)}?narrate=${narrate}`);
}

export function simulateCounterfactual(
  id: string,
  overrides: Record<string, number>,
): Promise<SimulationResult> {
  return request('/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: id, overrides }),
  });
}

export function signOrderBundle(payload: SignOrderPayload): Promise<OrderSignResponse> {
  return request('/orders/sign-and-transmit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchModelInfo(): Promise<ModelInfo> {
  return request('/model-info');
}

export function fetchHealth(): Promise<HealthStatus> {
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  const response = fetch(`${origin}/health`, { signal: AbortSignal.timeout(7000) });
  return response.then((result) => {
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    return result.json() as Promise<HealthStatus>;
  });
}
