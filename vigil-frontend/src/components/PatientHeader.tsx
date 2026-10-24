import React, { useEffect, useState } from 'react';
import { Activity, CheckSquare, Droplet, Heart, SlidersHorizontal, Wind } from 'lucide-react';
import { Patient, ScreenId } from '../types';
import { PATIENTS } from '../data/mockData';
import { useTelemetry } from '../hooks/useTelemetry';
import { BackendPatientDetail, BackendPatientSummary, fetchPatientRisk, fetchPatients } from '../services/api';
import { getRiskBand, RISK_BANDS } from '../constants/clinicalDisplay';

interface PatientHeaderProps {
  patient: Patient;
  onSelectPatient: (patient: Patient) => void;
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

export const PatientHeader: React.FC<PatientHeaderProps> = ({ patient, onSelectPatient, currentScreen, onNavigate }) => {
  const latestVital = patient.vitals[patient.vitals.length - 1];
  const { telemetry } = useTelemetry(patient.bed);
  const [backendData, setBackendData] = useState<BackendPatientDetail | null>(null);
  const [apiPatients, setApiPatients] = useState<BackendPatientSummary[]>([]);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [isPatientLoading, setIsPatientLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBackendUnavailable(false);
    setIsPatientLoading(true);
    setBackendData(null);
    fetchPatientRisk(patient.bed, false)
      .then((detail) => { if (!cancelled) setBackendData(detail); })
      .catch(() => { if (!cancelled) setBackendUnavailable(true); })
      .finally(() => { if (!cancelled) setIsPatientLoading(false); });
    fetchPatients()
      .then((patients) => { if (!cancelled) setApiPatients(patients); })
      .catch(() => { if (!cancelled) setApiPatients([]); });
    return () => { cancelled = true; };
  }, [patient.bed]);

  const displayHr = telemetry?.hr ?? backendData?.vitals.HR ?? (backendUnavailable ? latestVital.hr : '—');
  const displayMap = telemetry?.map ?? backendData?.vitals.MAP ?? (backendUnavailable ? latestVital.map : '—');
  const displaySpo2 = telemetry?.o2sat ?? backendData?.vitals.O2Sat ?? (backendUnavailable ? latestVital.spo2 : '—');
  const displayResp = telemetry?.resp ?? backendData?.vitals.Resp ?? (backendUnavailable ? latestVital.rr : '—');
  const displayedRisk = backendData?.sepsis_risk_percentage;
  const lactate = backendData?.vitals.Lactate ?? (backendUnavailable ? patient.lactate : '—');
  const selectorItems = apiPatients.length ? apiPatients : PATIENTS.map((item) => ({ id: item.id, bed: item.bed, name: item.name, primary_dx: item.primaryDiagnosis }));

  const selectPatient = (bed: string) => {
    const summary = apiPatients.find((item) => item.bed === bed);
    const fallback = PATIENTS.find((item) => item.bed === bed);
    if (summary) onSelectPatient({ ...(fallback ?? patient), id: summary.id, name: summary.name, bed: summary.bed, primaryDiagnosis: summary.primary_dx });
    else if (fallback) onSelectPatient(fallback);
  };

  return (
    <section id="patient-header" className="sticky top-[76px] z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="page-shell py-2">
        {backendUnavailable && <div role="status" className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-900">Backend unavailable · sample details shown; model risk is unavailable.</div>}
        <div className="flex min-w-0 items-center gap-2.5 overflow-x-auto pb-1">
          <div className="flex min-w-[190px] max-w-[250px] shrink-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-sm font-semibold tracking-tight text-slate-900">{backendData?.name ?? (backendUnavailable ? patient.name : isPatientLoading ? 'Loading patient…' : patient.bed)}</h1>
                <span className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-700">{patient.bed}</span>
              </div>
              <label htmlFor="patient-selector-dropdown" className="sr-only">Select demo patient</label>
              <select id="patient-selector-dropdown" value={patient.bed} onChange={(event) => selectPatient(event.target.value)} className="mt-1 w-full truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {selectorItems.map((item) => <option key={item.id} value={item.bed}>{item.name} · {item.bed}</option>)}
              </select>
            </div>
          </div>
          {(() => {
            const band = displayedRisk === undefined ? null : RISK_BANDS[getRiskBand(displayedRisk)];
            return <div className={`flex h-10 shrink-0 flex-col justify-center rounded-lg border px-2.5 ${band ? `${band.background} ${band.border}` : 'border-slate-200 bg-slate-50'}`}><span className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Estimate{band ? ` · ${getRiskBand(displayedRisk as number)}` : ''}</span><span className={`font-mono text-sm font-bold leading-4 ${band?.text ?? 'text-slate-500'}`}>{displayedRisk === undefined ? (backendUnavailable ? 'Sample' : '—') : `${displayedRisk.toFixed(1)}%`}</span></div>;
          })()}
          <VitalTile icon={<Activity />} label="MAP" value={displayMap} suffix="mmHg" />
          <VitalTile icon={<Heart />} label="HR" value={displayHr} suffix="bpm" />
          <VitalTile icon={<Wind />} label="Respiratory rate" value={displayResp} suffix="/min" />
          <VitalTile icon={<Activity />} label="SpO₂" value={displaySpo2} suffix="%" />
          <VitalTile icon={<Droplet />} label="Lactate" value={lactate} suffix="mmol/L" />
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-1" aria-label="Patient workflow">
          <WorkflowTab active={currentScreen === 'risk'} onClick={() => onNavigate('risk')} icon={<Activity />} label="Explain" />
          <WorkflowTab active={currentScreen === 'counterfactual'} onClick={() => onNavigate('counterfactual')} icon={<SlidersHorizontal />} label="What-if" />
          <WorkflowTab active={currentScreen === 'orders'} onClick={() => onNavigate('orders')} icon={<CheckSquare />} label="Sandbox" />
        </nav>
      </div>
    </section>
  );
};

const VitalTile = ({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: number | string; suffix: string }) => (
  <div className="flex h-10 shrink-0 flex-col justify-center rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5">
    <div className="flex items-center gap-1 text-[8px] font-semibold text-slate-500">{React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-2.5 w-2.5 text-slate-500' })}{label}</div>
    <div className="whitespace-nowrap font-mono text-xs font-bold leading-4 text-slate-800">{value}<span className="ml-1 text-[8px] font-medium text-slate-400">{suffix}</span></div>
  </div>
);

const WorkflowTab = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button onClick={onClick} className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold ${active ? 'bg-[#e9f5f2] text-[#075c57]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
    {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-3 w-3' })}{label}
  </button>
);
