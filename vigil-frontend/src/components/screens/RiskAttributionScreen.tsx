import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Cpu, SlidersHorizontal, Sparkles, WandSparkles } from 'lucide-react';
import { ScreenId, Patient } from '../../types';
import { BackendPatientDetail, FeatureContribution, fetchModelInfo, fetchPatientRisk, ModelInfo } from '../../services/api';
import { ModelInfoPanel } from '../ModelInfoPanel';
import { displayFeatureName, displayFeatureText, FEATURE_UNITS, getRiskBand, RISK_BANDS, RISK_BAND_NOTE } from '../../constants/clinicalDisplay';

interface RiskAttributionScreenProps { patient: Patient; onNavigate: (screen: ScreenId) => void; }

export const RiskAttributionScreen: React.FC<RiskAttributionScreenProps> = ({ patient, onNavigate }) => {
  const [backendData, setBackendData] = useState<BackendPatientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<FeatureContribution | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [narrationError, setNarrationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setBackendData(null);
    fetchPatientRisk(patient.bed, false)
      .then((data) => { if (!cancelled) setBackendData(data); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load model results.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [patient.bed]);

  useEffect(() => {
    let cancelled = false;
    fetchModelInfo().then((info) => { if (!cancelled) setModelInfo(info); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const contributions = useMemo(() => [...(backendData?.shap_contributions ?? [])].sort((a, b) => Math.abs(b.shap_impact) - Math.abs(a.shap_impact)), [backendData]);
  useEffect(() => { setSelectedFeature(contributions[0] ?? null); }, [contributions]);
  const maxImpact = Math.max(...contributions.map((item) => Math.abs(item.shap_impact)), 0.001);
  const riskBand = backendData ? getRiskBand(backendData.sepsis_risk_percentage) : null;
  const riskDisplay = riskBand ? RISK_BANDS[riskBand] : null;
  const riskColor = riskBand === 'high' ? 'text-rose-300' : riskBand === 'elevated' ? 'text-amber-300' : 'text-emerald-300';
  const riskBar = riskBand === 'high' ? 'bg-rose-400' : riskBand === 'elevated' ? 'bg-amber-300' : 'bg-emerald-300';

  const generateNarration = async () => {
    if (narrationLoading) return;
    setNarrationLoading(true);
    setNarrationError(null);
    try {
      const narrated = await fetchPatientRisk(patient.bed, true);
      setBackendData(narrated);
    } catch (reason) {
      setNarrationError(reason instanceof Error ? reason.message : 'Could not generate a summary.');
    } finally {
      setNarrationLoading(false);
    }
  };

  const narrationIsTemplate = backendData?.narration_source
    ? backendData.narration_source === 'template'
    : !backendData?.narration_model || backendData.narration_model === 'Template summary (LLM unavailable)';
  const narrationSourceLabel = backendData?.narration_source === 'live'
    ? 'Live'
    : backendData?.narration_source === 'cached'
      ? `Saved AI summary${backendData.narration_generated_at ? `, generated ${new Date(backendData.narration_generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`
      : 'Template summary (LLM unavailable)';

  return (
    <div className="min-h-screen pb-16">
      <div className="page-shell space-y-4 pt-4 sm:space-y-5 sm:pt-6">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-2"><Cpu className="h-4 w-4" /> Model interpretation</p>
            <h2 className="page-title mt-1.5">Risk attribution</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">Review the estimate alongside its inputs and leading contributors. This is decision support, not a diagnosis.</p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e9f5f2] text-[10px] font-bold text-[#075c57]">{patient.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
            <span><span className="block text-xs font-bold text-slate-800">{patient.name}</span><span className="block font-mono text-[10px] text-slate-500">{patient.bed}</span></span>
          </div>
        </div>

        {isLoading && <div className="surface p-10 text-center text-sm text-slate-500">Loading patient estimate and feature attribution…</div>}
        {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">Could not load this patient’s model result: {error}. No sample estimate is shown.</div>}

        {backendData && <>
          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            <section className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-[24px] bg-[#10263a] p-5 text-white shadow-lg shadow-[#10263a]/10 sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />
              <div className="relative flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300">Model estimate</p>
                    <div className={`mt-3 font-display text-6xl font-semibold leading-none tracking-[-0.06em] ${riskColor}`}>{backendData.sepsis_risk_percentage.toFixed(1)}<span className="ml-1 text-3xl">%</span></div>
                  </div>
                  <span className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-teal-200"><Activity className="h-6 w-6" /></span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${riskBar}`} style={{ width: `${Math.max(0, Math.min(100, backendData.sepsis_risk_percentage))}%` }} /></div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${riskDisplay?.background} ${riskDisplay?.text}`}>{riskDisplay?.label}</span>
                  <span className="text-[10px] font-medium text-slate-300">Baseline {modelInfo ? `${(modelInfo.positive_rate * 100).toFixed(1)}%` : '—'}</span>
                </div>
                <p className="mt-2 text-[9px] leading-4 text-slate-400">{RISK_BAND_NOTE}</p>
                <p className="mt-auto max-w-xl pt-5 text-xs leading-5 text-slate-300">A research model output for review alongside the patient’s full clinical context. It is not a diagnosis or a care recommendation.</p>
              </div>
            </section>

            <section className="surface flex h-full min-h-[320px] flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9f5f2] text-[#0b766e]"><Sparkles className="h-5 w-5" /></span>
                  <div><p className="eyebrow">Narrative summary</p><h3 className="mt-1 font-display text-lg font-semibold tracking-tight text-slate-900">What is driving this estimate?</h3></div>
                </div>
                {backendData.ai_narration && <span className={`max-w-[55%] rounded-full px-2.5 py-1 text-right text-[9px] font-bold tracking-wide ${narrationIsTemplate ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-800'}`}>{narrationSourceLabel}</span>}
              </div>
              <div className="flex-1 py-4">
                {backendData.ai_narration ? <p className="rounded-xl border border-slate-100 border-l-[3px] border-l-teal-600 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-700">{displayFeatureText(backendData.ai_narration)}</p> : <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"><p className="max-w-3xl text-xs leading-5 text-slate-600">Generate an optional narrative summary for this estimate. This makes a Groq API request.</p><button onClick={generateNarration} disabled={narrationLoading} className="primary-action mt-3 min-h-10 px-3 py-2 text-xs disabled:cursor-wait disabled:opacity-60"><WandSparkles className="h-4 w-4" />{narrationLoading ? 'Generating summary…' : 'Generate summary'}</button></div>}
                {backendData.ai_narration && backendData.narration_source === 'live' && backendData.narration_model && <p className="mt-2 text-[10px] font-medium text-slate-500">Groq · {backendData.narration_model}</p>}
                {backendData.ai_narration && backendData.narration_source && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  {backendData.narration_limit_reached
                    ? <span className="font-semibold text-amber-800">{backendData.narration_source === 'cached' ? 'Demo limit reached - showing the saved AI summary' : 'Demo limit reached - showing the template summary'}</span>
                    : <span>Live AI summaries remaining today: {backendData.live_narrations_remaining} of {backendData.live_narrations_limit}</span>}
                </div>}
                {narrationError && <p role="alert" className="mt-3 text-xs text-rose-700">Summary request failed: {narrationError}</p>}
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                <button onClick={() => onNavigate('counterfactual')} className="primary-action min-h-10 px-3 py-2 text-xs sm:w-auto"><SlidersHorizontal className="h-4 w-4" /> Explore a model scenario <ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
            </section>
          </div>

          <section className="surface p-5 sm:p-7">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> Model input snapshot</p>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-slate-900">Patient measurements</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Fixed values used by the model. Header vitals are a simulated stream.</p>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600">{Object.keys(backendData.vitals).length} features</span>
            </div>
            {(() => {
              const vitalNames = new Set(['HR', 'MAP', 'Resp', 'Temp', 'O2Sat']);
              const rows = Object.entries(backendData.vitals);
              const vitalRows = rows.filter(([feature]) => vitalNames.has(feature));
              const labRows = rows.filter(([feature]) => !vitalNames.has(feature));
              const renderRows = (items: typeof rows) => (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 bg-slate-50 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">
                    <span>Measurement</span><span className="text-right">Result</span><span className="w-16 text-left">Unit</span>
                  </div>
                  {items.map(([feature, value], index) => (
                    <div key={feature} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 ${index ? 'border-t border-slate-100' : ''}`}>
                      <span className="text-xs font-medium text-slate-700">{displayFeatureName(feature)}</span>
                      <span className="min-w-12 text-right font-mono text-sm font-semibold tabular-nums text-slate-900">{value}</span>
                      <span className="w-16 text-left text-[10px] text-slate-500">{FEATURE_UNITS[feature] || '—'}</span>
                    </div>
                  ))}
                  {items.length === 0 && <p className="px-4 py-5 text-xs text-slate-500">No measurements available.</p>}
                </div>
              );
              return (
                <div className="grid gap-5 pt-5 md:grid-cols-2">
                  <div><h4 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-600">Vital signs</h4>{renderRows(vitalRows)}</div>
                  <div><h4 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-600">Laboratory results</h4>{renderRows(labRows)}</div>
                </div>
              );
            })()}
          </section>

          <section className="surface p-5 sm:p-7">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="eyebrow flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> Feature attribution</p><h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-slate-900">Factors behind the estimate</h3><p className="mt-1 text-xs text-slate-500">Sorted by absolute SHAP impact. SHAP contributions are in log-odds units, not percentage points.</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600">{contributions.length} model features</span>
            </div>
            {contributions.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No feature contributions were returned.</p> : (
              <div className="grid gap-5 pt-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-2">
                  {contributions.map((item) => {
                    const positive = item.direction === 'increases_risk';
                    const selected = selectedFeature?.feature === item.feature;
                    return (
                      <button key={item.feature} type="button" onClick={() => setSelectedFeature(item)} className={`w-full rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-teal-300 bg-[#eff8f5]' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/80'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0"><span className="text-xs font-bold text-slate-800">{displayFeatureName(item.feature)}</span><span className="ml-2 text-[10px] text-slate-500">Observed {item.value} {FEATURE_UNITS[item.feature]}</span></div>
                          <span className={`shrink-0 font-mono text-xs font-bold ${positive ? 'text-rose-700' : 'text-emerald-700'}`}>{item.shap_impact > 0 ? '+' : ''}{item.shap_impact.toFixed(4)}</span>
                        </div>
                        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${positive ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(2, Math.abs(item.shap_impact) / maxImpact * 100)}%` }} /></div>
                        <div className={`mt-1.5 text-[9px] font-bold uppercase tracking-[0.08em] ${positive ? 'text-rose-700' : 'text-emerald-700'}`}>{positive ? 'Increases risk estimate' : 'Decreases risk estimate'}</div>
                      </button>
                    );
                  })}
                </div>
                <aside className="rounded-2xl bg-[#f4f7f8] p-5 lg:sticky lg:top-56 lg:self-start">
                  {selectedFeature ? <>
                    <p className="eyebrow">Selected factor</p>
                    <h4 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">{displayFeatureName(selectedFeature.feature)}</h4>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Observed value</p><p className="mt-1 font-mono text-lg font-bold text-slate-800">{selectedFeature.value} {FEATURE_UNITS[selectedFeature.feature]}</p></div>
                      <div className="rounded-xl border border-white bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">SHAP impact</p><p className={`mt-1 font-mono text-lg font-bold ${selectedFeature.direction === 'increases_risk' ? 'text-rose-700' : 'text-emerald-700'}`}>{selectedFeature.shap_impact > 0 ? '+' : ''}{selectedFeature.shap_impact.toFixed(4)}</p></div>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-slate-600">This attribution describes how the model used this feature for the current estimate. It does not establish causality or predict the effect of treatment.</p>
                  </> : <p className="text-sm text-slate-500">Select a factor to inspect its value and contribution.</p>}
                </aside>
              </div>
            )}
          </section>
        </>}

        <ModelInfoPanel compact />
      </div>
    </div>
  );
};
