import { Patient, ClinicalOrder } from '../types';

// Used only when the backend is unreachable; the UI labels these values as sample data.
export const PATIENTS: Patient[] = [
  {
    id: 'MICU-402', name: 'Eleanor Vance', age: 68, gender: 'F', bed: 'MICU-402',
    primaryDiagnosis: 'Suspected infection (demo record)', sepsisRisk: 87, lactate: 3.4,
    vitals: [{ hr: 118, map: 58, rr: 29, spo2: 89 }],
  },
  {
    id: 'MICU-114', name: 'Marcus Webb', age: 54, gender: 'M', bed: 'MICU-114',
    primaryDiagnosis: 'Post-operative recovery (demo record)', sepsisRisk: 12, lactate: 1.1,
    vitals: [{ hr: 78, map: 82, rr: 16, spo2: 98 }],
  },
  {
    id: 'ICU-207', name: 'Priya Nair', age: 71, gender: 'F', bed: 'ICU-207',
    primaryDiagnosis: 'Pneumonia (demo record)', sepsisRisk: 54, lactate: 2.1,
    vitals: [{ hr: 98, map: 68, rr: 20, spo2: 95 }],
  },
  {
    id: 'ICU-311', name: "James O'Connor", age: 45, gender: 'M', bed: 'ICU-311',
    primaryDiagnosis: 'Trauma recovery (demo record)', sepsisRisk: 24, lactate: 1.4,
    vitals: [{ hr: 88, map: 75, rr: 17, spo2: 97 }],
  },
];

export const DEFAULT_ORDERS: ClinicalOrder[] = [
  {
    id: 'demo-model', category: 'Model review', title: 'I reviewed the model estimate',
    dosageInstructions: 'Reviewer acknowledgement only', urgency: 'Routine', selected: true,
    indication: 'Acknowledgement of model estimate review.', demoNote: '',
  },
  {
    id: 'demo-explanation', category: 'Explanation', title: 'I reviewed the top contributing factors',
    dosageInstructions: 'Reviewer acknowledgement only', urgency: 'Routine', selected: true,
    indication: 'Acknowledgement of feature attribution review.', demoNote: '',
  },
  {
    id: 'demo-what-if', category: 'What-if', title: 'I reviewed a what-if scenario (optional)',
    dosageInstructions: 'Reviewer acknowledgement only', urgency: 'Routine', selected: false,
    indication: 'Optional acknowledgement of model input scenario review.', demoNote: '',
  },
];
