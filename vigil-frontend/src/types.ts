export type ScreenId =
  | 'landing'
  | 'queue'
  | 'risk'
  | 'counterfactual'
  | 'orders';

export interface VitalRecord {
  hr: number;
  map: number;
  rr: number;
  spo2: number;
}

/** Minimal patient view model. All populated risk/vital values are offline samples. */
export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'F' | 'M';
  bed: string;
  primaryDiagnosis: string;
  sepsisRisk: number;
  lactate: number;
  vitals: VitalRecord[];
}

export interface ClinicalOrder {
  id: string;
  category: 'Model review' | 'Explanation' | 'What-if' | 'Demo';
  title: string;
  dosageInstructions: string;
  urgency: 'Routine';
  selected: boolean;
  indication: string;
  demoNote: string;
}
