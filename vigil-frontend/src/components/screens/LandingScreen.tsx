import React, { useEffect, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, CheckCircle2, CircleHelp, Cpu, Database, ShieldCheck, SlidersHorizontal, Wifi, WifiOff } from 'lucide-react';
import { ScreenId } from '../../types';
import { fetchPatients } from '../../services/api';

interface LandingScreenProps { onNavigate: (screen: ScreenId) => void; }

const DEMO_STEPS: { number: string; title: string; detail: string; screen: ScreenId; icon: React.ReactNode }[] = [
  { number: '01', title: 'Select a patient', detail: 'Review the fictional ICU cohort and backend model estimates.', screen: 'queue', icon: <Database /> },
  { number: '02', title: 'Understand the estimate', detail: 'Inspect patient inputs, feature attribution, and narration.', screen: 'risk', icon: <Cpu /> },
  { number: '03', title: 'Explore a scenario', detail: 'Change model features and request a new server-side estimate.', screen: 'counterfactual', icon: <SlidersHorizontal /> },
  { number: '04', title: 'Review the receipt', detail: 'Record a simulated sandbox bundle and inspect its audit hash.', screen: 'orders', icon: <CheckCircle2 /> },
];

export const LandingScreen: React.FC<LandingScreenProps> = ({ onNavigate }) => {
  const [connection, setConnection] = useState<'checking' | 'online' | 'offline'>('checking');
  const [patientCount, setPatientCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPatients()
      .then((patients) => {
        if (cancelled) return;
        setPatientCount(patients.length);
        setConnection('online');
      })
      .catch(() => {
        if (cancelled) return;
        setPatientCount(null);
        setConnection('offline');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen pb-16">
      <section className="px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
        <div className="page-shell overflow-hidden rounded-[30px] bg-[#10263a] shadow-2xl shadow-[#10263a]/15">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative flex flex-col justify-center overflow-hidden px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
              <div className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full border border-white/10" />
              <div className="relative z-10">
                <div className="mb-7 flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/85">
                    <ShieldCheck className="h-3.5 w-3.5 text-teal-300" /> Explainable ICU prototype
                  </span>
                  <span role="status" className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold ${connection === 'online' ? 'bg-emerald-400/15 text-emerald-200' : connection === 'offline' ? 'bg-amber-300/15 text-amber-200' : 'bg-white/10 text-white/70'}`}>
                    {connection === 'online' ? <Wifi className="h-3.5 w-3.5" /> : connection === 'offline' ? <WifiOff className="h-3.5 w-3.5" /> : <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />}
                    {connection === 'online' ? `API connected · ${patientCount} demo patients` : connection === 'offline' ? 'API offline · sample mode' : 'Connecting to local API'}
                  </span>
                </div>

                <p className="eyebrow !text-teal-300">Vigil AI · Clinical decision support</p>
                <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.7rem]">
                  See what shapes each model estimate.
                </h1>
                <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                  Inspect patient inputs, understand the strongest contributing factors, and explore how illustrative scenarios change the model output.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button onClick={() => onNavigate('queue')} className="primary-action bg-teal-600">
                    Start patient review <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-7 flex items-center gap-2 text-[11px] text-slate-400">
                  <CircleHelp className="h-3.5 w-3.5 shrink-0" />
                  Research prototype only. Not clinically validated or intended to guide care.
                </div>
              </div>
            </div>

            <div className="relative flex items-center bg-gradient-to-br from-[#17384d] to-[#0e3040] px-6 py-8 sm:px-10 lg:px-9">
              <div className="absolute right-[-3rem] top-[-4rem] h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />
              <div className="relative w-full rounded-[24px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm sm:p-6">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-200">A guided workflow</p>
                    <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-white">From estimate to explanation</h2>
                  </div>
                  <span className="rounded-xl border border-teal-200/20 bg-teal-300/10 p-2.5 text-teal-200"><Activity className="h-5 w-5" /></span>
                </div>
                <div className="mt-2">
                  {DEMO_STEPS.map((step, index) => (
                    <button key={step.number} onClick={() => onNavigate(step.screen)} className="group flex w-full items-start gap-4 border-b border-white/[0.08] py-4 text-left last:border-0">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${index === 0 ? 'border-teal-200/25 bg-teal-200/10 text-teal-200' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
                        {React.cloneElement(step.icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' })}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[13px] font-bold text-white"><span className="font-mono text-[10px] text-teal-200/80">{step.number}</span>{step.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{step.detail}</span>
                      </span>
                      <ArrowDownRight className="mt-1 h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-teal-200" />
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-[10px] leading-relaxed text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" /> XGBoost estimate · TreeSHAP attribution · simulated sandbox workflow
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">What you can explore</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">A clear, reviewable workflow</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard icon={<Cpu />} title="Understand the estimate" detail="Review the model output alongside the patient inputs and the largest SHAP contributions." />
          <InfoCard icon={<SlidersHorizontal />} title="Explore model scenarios" detail="Change feature values and ask the backend to calculate an updated model estimate." />
          <InfoCard icon={<CheckCircle2 />} title="Inspect the sandbox receipt" detail="Record a simulated bundle and review its timestamp and SHA-256 content hash." />
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-950">
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p>Demo records are fictional. Model estimates are not clinically validated, do not establish a diagnosis, and must not guide patient care.</p>
        </div>
      </section>
    </div>
  );
};

const InfoCard = ({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) => (
  <article className="surface flex gap-4 p-5 sm:p-6">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f5f2] text-[#0b766e]">{icon}</span>
    <div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-1.5 text-xs leading-5 text-slate-600">{detail}</p></div>
  </article>
);
