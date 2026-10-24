export type RiskBand = 'low' | 'elevated' | 'high';

export const RISK_BANDS = {
  low: { min: 0, max: 15, label: 'Low', text: 'text-emerald-800', background: 'bg-emerald-50', border: 'border-emerald-200', solid: 'bg-emerald-500' },
  elevated: { min: 15, max: 40, label: 'Elevated', text: 'text-amber-800', background: 'bg-amber-50', border: 'border-amber-200', solid: 'bg-amber-500' },
  high: { min: 40, max: 100, label: 'High', text: 'text-rose-800', background: 'bg-rose-50', border: 'border-rose-200', solid: 'bg-rose-500' },
} as const;

export const RISK_BAND_NOTE = 'Illustrative display bands, not clinical thresholds';

export function getRiskBand(risk: number): RiskBand {
  if (risk < RISK_BANDS.low.max) return 'low';
  if (risk < RISK_BANDS.elevated.max) return 'elevated';
  return 'high';
}

export const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  HR: 'Heart rate',
  MAP: 'MAP',
  Resp: 'Respiratory rate',
  Temp: 'Temperature',
  O2Sat: 'SpO₂',
  Lactate: 'Lactate',
  WBC: 'WBC',
  Platelets: 'Platelets',
  Creatinine: 'Creatinine',
  HCO3: 'Bicarbonate (HCO₃)',
  BUN: 'BUN',
  Glucose: 'Glucose',
  Bilirubin_total: 'Bilirubin (total)',
};

export const FEATURE_UNITS: Record<string, string> = {
  HR: 'bpm', MAP: 'mmHg', Resp: '/min', Temp: '°C', O2Sat: '%', Lactate: 'mmol/L',
  WBC: '×10⁹/L', Platelets: '×10⁹/L', Creatinine: 'mg/dL', HCO3: 'mmol/L',
  BUN: 'mg/dL', Glucose: 'mg/dL', Bilirubin_total: 'mg/dL',
};

export function displayFeatureName(feature: string): string {
  return FEATURE_DISPLAY_NAMES[feature] ?? feature;
}

export function displayFeatureText(text: string): string {
  return Object.entries(FEATURE_DISPLAY_NAMES).reduce(
    (result, [key, label]) => result.replace(new RegExp(`\\b${key}\\b`, 'g'), label),
    text,
  );
}
