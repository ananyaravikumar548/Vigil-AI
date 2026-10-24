import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Clock, Filter, Search, ShieldAlert } from 'lucide-react';
import { ScreenId, Patient } from '../../types';
import { PATIENTS } from '../../data/mockData';
import { BackendPatientDetail, BackendPatientSummary, fetchPatientRisk, fetchPatients } from '../../services/api';
import { getRiskBand, RISK_BANDS, RISK_BAND_NOTE } from '../../constants/clinicalDisplay';

interface QueueScreenProps {
  activePatient: Patient;
  onSelectPatient: (patient: Patient) => void;
  onNavigate: (screen: ScreenId) => void;
}

interface QueueRow {
  summary: BackendPatientSummary;
  detail: BackendPatientDetail | null;
  patient: Patient;
}

const fallbackRows = (): QueueRow[] => PATIENTS.map((patient) => ({
  summary: { id: patient.bed, name: patient.name, bed: patient.bed, primary_dx: patient.primaryDiagnosis },
  detail: null,
  patient,
}));

export const QueueScreen: React.FC<QueueScreenProps> = ({ activePatient, onSelectPatient, onNavigate }) => {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [filterRisk, setFilterRisk] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setBackendConnected(false);
    setIsOfflineFallback(false);
    fetchPatients()
      .then(async (summaries) => {
        const details = await Promise.all(summaries.map(async (summary) => {
          try { return await fetchPatientRisk(summary.id, false); } catch { return null; }
        }));
        if (cancelled) return;
        setBackendConnected(true);
        const nextRows = summaries.map((summary, index) => {
          const detail = details[index];
          const template = PATIENTS.find((patient) => patient.bed === summary.bed) ?? PATIENTS[0];
          const patient: Patient = {
            ...template,
            id: summary.id,
            name: summary.name,
            bed: summary.bed,
            primaryDiagnosis: summary.primary_dx,
            ...(detail ? {
              age: detail.age,
              gender: detail.gender === 'F' ? 'F' as const : 'M' as const,
              sepsisRisk: detail.sepsis_risk_percentage,
              vitals: template.vitals.map((vital, vitalIndex) => vitalIndex === template.vitals.length - 1 ? {
                ...vital,
                hr: detail.vitals.HR ?? vital.hr,
                map: detail.vitals.MAP ?? vital.map,
                rr: detail.vitals.Resp ?? vital.rr,
                spo2: detail.vitals.O2Sat ?? vital.spo2,
              } : vital),
            } : {}),
          };
          return { summary, detail, patient };
        });
        setRows(nextRows);
      })
      .catch(() => {
        if (cancelled) return;
        setRows(fallbackRows());
        setIsOfflineFallback(true);
        setBackendConnected(false);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const isLive = backendConnected && !isOfflineFallback;
  const withRisk = rows.filter((row) => row.detail !== null);
  const highCount = withRisk.filter((row) => getRiskBand(row.detail?.sepsis_risk_percentage ?? 0) === 'high').length;
  const elevatedCount = withRisk.filter((row) => getRiskBand(row.detail?.sepsis_risk_percentage ?? 0) === 'elevated').length;
  const filteredRows = useMemo(() => rows.filter(({ summary, detail, patient }) => {
    const query = searchQuery.toLowerCase();
    if (!`${summary.name} ${summary.bed} ${summary.primary_dx}`.toLowerCase().includes(query)) return false;
    if (!detail && !isOfflineFallback && filterRisk !== 'all') return false;
    const risk = detail?.sepsis_risk_percentage ?? (isOfflineFallback ? patient.sepsisRisk : null);
    if (filterRisk !== 'all' && risk === null) return false;
    if (filterRisk !== 'all') return getRiskBand(risk) === filterRisk;
    return true;
  }), [rows, searchQuery, filterRisk, isOfflineFallback]);

  return (
    <div className="min-h-screen pb-16">
      <div className="page-shell space-y-5 pt-6 sm:pt-8">
        <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Seeded demo cohort</div>
            <h1 className="page-title mt-2">Patient queue</h1>
            <p className="mt-2 text-sm text-slate-500">Review the seeded cohort and open a patient’s model explanation.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Metric icon={<ShieldAlert />} label="High estimate" value={isLive ? `${highCount} ${highCount === 1 ? 'patient' : 'patients'}` : '—'} tone="rose" />
            <Metric icon={<AlertTriangle />} label="Elevated" value={isLive ? `${elevatedCount} ${elevatedCount === 1 ? 'patient' : 'patients'}` : '—'} tone="amber" />
            <Metric icon={<Clock />} label="Results loaded" value={isLive ? `${withRisk.length} / ${rows.length}` : '—'} tone="teal" />
          </div>
        </header>

        {isOfflineFallback && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">Backend offline · showing sample profiles. Sample scores are not live model results.</div>}
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

        <section className="surface p-3 sm:p-4" aria-label="Search and filter patients">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <label className="relative block w-full xl:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name, bed, or diagnosis" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0">
              <span className="mr-1 inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Filter className="h-3.5 w-3.5" /> Risk filter</span>
              {([['all', 'All'], ['low', `Low <${RISK_BANDS.low.max}%`], ['elevated', `Elevated ${RISK_BANDS.elevated.min}–<${RISK_BANDS.elevated.max}%`], ['high', `High ≥${RISK_BANDS.high.min}%`]] as const).map(([id, label]) => {
                const band = id === 'all' ? null : RISK_BANDS[id];
                return <button key={id} onClick={() => setFilterRisk(id)} className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold ${filterRisk === id ? band ? `${band.background} ${band.text} ${band.border}` : 'border-slate-700 bg-[#10263a] text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{label}</button>;
              })}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">Demo cohort</h2><span className="text-[10px] font-medium text-slate-500">{filteredRows.length} {filteredRows.length === 1 ? 'patient' : 'patients'} <span className="hidden sm:inline">· {RISK_BAND_NOTE}</span></span></div>
        {isLoading ? <div className="surface p-10 text-center text-sm text-slate-500">Loading patient records…</div> : filteredRows.length === 0 ? <div className="surface p-10 text-center text-sm text-slate-600">No patients match this search or filter.</div> : (
          <div className="grid gap-3">
            {filteredRows.map(({ summary, detail, patient }) => {
              const risk = detail?.sepsis_risk_percentage ?? patient.sepsisRisk;
              const riskTone = getRiskBand(risk);
              const riskText = detail ? `${risk.toFixed(1)}%` : isOfflineFallback ? `${risk}% sample` : 'Unavailable';
              return (
                <button key={summary.id} type="button" onClick={() => { onSelectPatient(patient); onNavigate('risk'); }} className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5 ${activePatient.bed === summary.bed ? 'border-teal-300 ring-2 ring-teal-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className={`absolute inset-y-0 left-0 w-1 ${RISK_BANDS[riskTone].solid}`} />
                  <div className="flex flex-col gap-4 pl-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 text-center"><span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Bed</span><span className="mt-0.5 font-mono text-[10px] font-bold text-slate-700">{summary.bed}</span></span>
                      <span className="min-w-0"><span className="font-display text-base font-semibold tracking-tight text-slate-900">{summary.name}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{summary.primary_dx}</span><span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500"><span><Activity className="mr-1 inline h-3 w-3" />HR {detail?.vitals.HR ?? '—'}</span><span>MAP {detail?.vitals.MAP ?? '—'}</span><span>SpO₂ {detail?.vitals.O2Sat ?? '—'}%</span></span></span>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className={`rounded-xl border px-3 py-2 text-right ${RISK_BANDS[riskTone].background} ${RISK_BANDS[riskTone].text} ${RISK_BANDS[riskTone].border}`}><span className="block text-[8px] font-bold uppercase tracking-[0.12em] opacity-70">{RISK_BANDS[riskTone].label} estimate</span><span className="mt-0.5 block font-mono text-lg font-bold leading-none">{riskText}</span></span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition group-hover:border-teal-300 group-hover:bg-[#e9f5f2] group-hover:text-teal-700"><ArrowRight className="h-4 w-4" /></span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const Metric = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'rose' | 'amber' | 'teal' }) => <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 sm:px-3.5"><div className={`flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.08em] sm:text-[9px] ${tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : 'text-teal-700'}`}>{React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-3.5 w-3.5 shrink-0' })}<span className="truncate">{label}</span></div><div className="mt-1 font-mono text-xs font-bold text-slate-800 sm:text-sm">{value}</div></div>;
