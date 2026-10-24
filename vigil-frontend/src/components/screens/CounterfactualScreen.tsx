import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, RotateCcw, Sliders } from 'lucide-react';
import { ScreenId, Patient } from '../../types';
import { BackendPatientDetail, SimulationResult, fetchPatientRisk, simulateCounterfactual } from '../../services/api';
import { displayFeatureName, FEATURE_UNITS } from '../../constants/clinicalDisplay';

interface CounterfactualScreenProps { patient: Patient; onNavigate: (screen: ScreenId) => void; }

const FEATURE_LIMITS: Record<string, { min: number; max: number; step: number; unit: string }> = {
  Lactate: { min: 0.5, max: 8, step: 0.1, unit: 'mmol/L' },
  MAP: { min: 50, max: 110, step: 1, unit: 'mmHg' },
  HR: { min: 40, max: 150, step: 1, unit: 'bpm' },
  Resp: { min: 8, max: 40, step: 1, unit: '/min' },
  Temp: { min: 35, max: 41, step: 0.1, unit: '°C' },
  O2Sat: { min: 50, max: 100, step: 1, unit: '%' },
  WBC: { min: 1, max: 30, step: 0.1, unit: '×10⁹/L' },
  Platelets: { min: 20, max: 500, step: 1, unit: '×10⁹/L' },
  Creatinine: { min: 0.3, max: 8, step: 0.1, unit: 'mg/dL' },
  HCO3: { min: 8, max: 36, step: 0.1, unit: 'mmol/L' },
  BUN: { min: 5, max: 80, step: 1, unit: 'mg/dL' },
  Glucose: { min: 50, max: 300, step: 1, unit: 'mg/dL' },
  Bilirubin_total: { min: 0.1, max: 8, step: 0.1, unit: 'mg/dL' },
};

export const CounterfactualScreen: React.FC<CounterfactualScreenProps> = ({ patient, onNavigate }) => {
  const [patientData, setPatientData] = useState<BackendPatientDetail | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setPatientData(null);
    setResult(null);
    setOverrides({});
    fetchPatientRisk(patient.bed, false)
      .then((data) => { if (!cancelled) setPatientData(data); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load patient features.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [patient.bed]);

  const activeOverrides = useMemo(() => Object.fromEntries(Object.entries(overrides).filter(([feature, value]) => patientData?.vitals[feature] !== value)), [overrides, patientData]);

  useEffect(() => {
    if (!patientData || Object.keys(activeOverrides).length === 0) {
      setResult(null);
      setIsSimulating(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setIsSimulating(true);
      setError(null);
      simulateCounterfactual(patient.bed, activeOverrides)
        .then((simulation) => { if (!cancelled) setResult(simulation); })
        .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Simulation request failed.'); })
        .finally(() => { if (!cancelled) setIsSimulating(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [patient.bed, patientData, activeOverrides]);

  const updateFeature = (feature: string, value: number) => {
    setResult(null);
    setError(null);
    setOverrides((current) => ({ ...current, [feature]: value }));
  };
  const reset = () => { setOverrides({}); setResult(null); setError(null); };

  const applyPreset = (preset: Record<string, number>) => {
    setOverrides(preset);
    setResult(null);
    setError(null);
  };

  return <div className="min-h-screen pb-16"><div className="page-shell pt-6 space-y-6">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200"><div><div className="flex items-center gap-2 text-[10px] font-mono text-teal-700 font-bold uppercase tracking-[0.14em]"><Sliders className="w-4 h-4" /> Model feature scenario</div><h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mt-2 font-display">Explore a what-if scenario</h1><p className="text-sm text-slate-500 mt-2 max-w-2xl">Change a feature value and see how the backend model estimate responds.</p></div><button onClick={reset} disabled={!patientData} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-semibold flex items-center gap-2 disabled:opacity-50 hover:bg-slate-50"><RotateCcw className="w-3.5 h-3.5" /> Reset values</button></div>
    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs leading-relaxed text-amber-950"><strong className="mr-1">Scenario only.</strong>Illustrative slider ranges. This changes model inputs; it does not estimate treatment effects or predict clinical outcomes. Interpret results with clinical evaluation.</div>
    {isLoading && <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-600">Loading patient model inputs…</div>}
    {error && <div role="alert" className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-900">{error}</div>}
    {patientData && <>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RiskCard label="Baseline risk" value={`${patientData.sepsis_risk_percentage.toFixed(1)}%`} />
        <RiskCard label="Scenario risk" value={result ? `${result.simulated_risk_percentage.toFixed(1)}%` : '—'} detail={isSimulating ? 'Updating from backend…' : result ? `${result.risk_change_percentage_points > 0 ? '+' : ''}${result.risk_change_percentage_points.toFixed(1)} percentage points` : 'Change a feature to simulate'} />
        <RiskCard label="Features overridden" value={`${Object.keys(activeOverrides).length}`} detail="Values sent to backend model" />
      </section>
      <section className="bg-white border border-slate-200 rounded-[22px] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100"><div className="flex items-center gap-2"><Activity className="w-4 h-4 text-teal-700" /><h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">Model feature inputs</h2></div><span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600">Illustrative ranges</span></div>
        <p className="mt-3 text-xs text-slate-600">Each slider value is sent to the backend model as a new input. The bounds are illustrative reference ranges, not model-derived limits.</p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Scenario presets">
          <button type="button" onClick={() => applyPreset({ Lactate: Math.max(0.5, Math.min(8, 1.2)) })} disabled={patientData.vitals.Lactate === undefined} className="secondary-action px-3 py-2 text-[11px] disabled:opacity-50">Normalize lactate · 1.2</button>
          <button type="button" onClick={() => applyPreset({ MAP: 75 })} disabled={patientData.vitals.MAP === undefined} className="secondary-action px-3 py-2 text-[11px] disabled:opacity-50">Raise MAP · 75</button>
          <button type="button" onClick={() => applyPreset({ Lactate: 1.2, MAP: 75 })} disabled={patientData.vitals.Lactate === undefined || patientData.vitals.MAP === undefined} className="secondary-action px-3 py-2 text-[11px] disabled:opacity-50">Set both values</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{Object.entries(FEATURE_LIMITS).map(([feature, limits]) => {
          const baseline = patientData.vitals[feature];
          if (baseline === undefined) return null;
          const value = overrides[feature] ?? baseline;
          const sliderValue = Math.max(limits.min, Math.min(limits.max, value));
          return <div key={feature} className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200"><div className="flex justify-between items-center gap-3"><label htmlFor={`feature-${feature}`} className="text-sm font-bold text-slate-800">{displayFeatureName(feature)}</label><span className="font-mono text-sm font-bold text-teal-800">{value} <span className="text-[10px] font-normal text-slate-500">{FEATURE_UNITS[feature] ?? limits.unit}</span></span></div><input id={`feature-${feature}`} aria-label={`${displayFeatureName(feature)} model input`} type="range" min={limits.min} max={limits.max} step={limits.step} value={sliderValue} onChange={(event) => updateFeature(feature, Number(event.target.value))} className="w-full mt-4 accent-teal-700"/><div className="flex justify-between text-[10px] font-mono text-slate-500"><span>Patient value: {baseline}</span><span>{limits.min}–{limits.max}</span></div></div>;
        })}</div>
        {result && <div className="mt-5 p-4 rounded-xl border border-slate-200"><h3 className="text-xs font-bold text-slate-800 mb-3">Server-returned SHAP contributions (log-odds units)</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{[...result.simulated_contributions].sort((a, b) => Math.abs(b.shap_impact) - Math.abs(a.shap_impact)).map((item) => <div key={item.feature} className="flex justify-between p-2 rounded-lg bg-slate-50 text-xs"><span>{displayFeatureName(item.feature)}: {item.value} {FEATURE_UNITS[item.feature]}</span><strong className={item.direction === 'increases_risk' ? 'text-rose-700' : 'text-emerald-700'}>{item.shap_impact > 0 ? '+' : ''}{item.shap_impact.toFixed(4)}</strong></div>)}</div></div>}
      </section>
      <div className="surface-muted flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><p className="text-xs font-bold text-slate-800">Next step</p><p className="mt-1 text-xs text-slate-600">Continue to the simulated sandbox to review and record your acknowledgement.</p></div>
        <button onClick={() => onNavigate('orders')} className="primary-action min-h-10 px-4 py-2 text-xs">Review sandbox receipt <ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
    </>}
  </div></div>;
};

const RiskCard = ({ label, value, detail }: { label: string; value: string; detail?: string }) => <div className="p-5 sm:p-6 rounded-[22px] bg-white border border-slate-200 shadow-sm"><div className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-[0.12em]">{label}</div><div className="text-3xl sm:text-4xl font-bold font-display text-slate-900 mt-3 tracking-tight">{value}</div>{detail && <div className="text-xs text-slate-600 mt-2">{detail}</div>}</div>;
