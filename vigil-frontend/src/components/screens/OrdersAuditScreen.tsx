import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckSquare, Clipboard, Copy, FileCheck2, Info, Square } from 'lucide-react';
import { ScreenId, Patient, ClinicalOrder } from '../../types';
import { DEFAULT_ORDERS } from '../../data/mockData';
import { BackendPatientDetail, fetchPatientRisk, OrderSignResponse, signOrderBundle } from '../../services/api';

interface OrdersAuditScreenProps {
  patient: Patient;
  onNavigate: (screen: ScreenId) => void;
}

export const OrdersAuditScreen: React.FC<OrdersAuditScreenProps> = ({ patient, onNavigate }) => {
  const [items, setItems] = useState<ClinicalOrder[]>(() => DEFAULT_ORDERS.map((item, index) => ({ ...item, selected: index < 2 })));
  const [reviewerNote, setReviewerNote] = useState('');
  const [patientData, setPatientData] = useState<BackendPatientDetail | null>(null);
  const [isLoadingPatient, setIsLoadingPatient] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<OrderSignResponse | null>(null);
  const [receiptEstimate, setReceiptEstimate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPatientData(null);
    setReceipt(null);
    setReceiptEstimate(null);
    setReviewerNote('');
    setItems(DEFAULT_ORDERS.map((item, index) => ({ ...item, selected: index < 2 })));
    setIsLoadingPatient(true);
    fetchPatientRisk(patient.bed, false)
      .then((detail) => { if (!cancelled) setPatientData(detail); })
      .catch(() => { if (!cancelled) setPatientData(null); })
      .finally(() => { if (!cancelled) setIsLoadingPatient(false); });
    return () => { cancelled = true; };
  }, [patient.bed]);

  const selectedCount = items.filter((item) => item.selected).length;
  const modelEstimate = patientData?.sepsis_risk_percentage ?? null;
  const payload = useMemo(() => ({
    patient_id: patient.bed,
    clinician_name: 'Demo Reviewer',
    selected_orders: items.filter((item) => item.selected).map((item) => (
      reviewerNote.trim() ? `${item.title} — Reviewer note: ${reviewerNote.trim()}` : item.title
    )),
  }), [items, patient.bed, reviewerNote]);

  const updateSelected = (id: string) => {
    setReceipt(null);
    setError(null);
    setItems((current) => current.map((item) => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const selectRecommended = () => {
    setReceipt(null);
    setError(null);
    setItems((current) => current.map((item, index) => ({ ...item, selected: index < 2 })));
  };

  const submitReceipt = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signOrderBundle(payload);
      setReceipt(result);
      setReceiptEstimate(modelEstimate);
      setCopied(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the simulated review acknowledgement receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyHash = async () => {
    if (!receipt) return;
    try {
      await navigator.clipboard.writeText(receipt.integrity_signature_sha256);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy the receipt hash. Select and copy it manually.');
    }
  };

  return (
    <div className="min-h-screen pb-16">
      <div className="page-shell space-y-6 pt-6">

        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-2"><FileCheck2 className="h-4 w-4" /> Reviewer workflow</p>
            <h1 className="page-title mt-2 scroll-mt-44">Review acknowledgement receipt</h1>
            <p className="mt-2 text-sm text-slate-500">Record which parts of the decision-support demo you reviewed.</p>
          </div>
          <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide text-amber-800">SIMULATED SANDBOX</span>
        </header>

        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p><strong>Simulated sandbox — not a real EHR, not a digital signature.</strong> This demo records reviewer acknowledgement strings only; it does not create clinical orders. No guideline linkage is provided.</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="surface p-5 sm:p-6" aria-labelledby="acknowledgements-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 id="acknowledgements-title" className="font-display text-lg font-semibold text-slate-900">Review acknowledgements</h2>
                <p className="mt-1 text-xs text-slate-500">Choose the statements that apply to this review.</p>
              </div>
              <button type="button" onClick={selectRecommended} className="secondary-action px-3 py-2 text-[11px]">Select recommended</button>
            </div>

            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${item.selected ? 'border-teal-300 bg-teal-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" className="sr-only" checked={item.selected} onChange={() => updateSelected(item.id)} />
                  <span className={`mt-0.5 shrink-0 ${item.selected ? 'text-teal-700' : 'text-slate-400'}`} aria-hidden="true">{item.selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">Reviewer acknowledgement</span>
                    <span className="mt-2 block text-sm font-semibold leading-5 text-slate-800">{item.title}</span>
                  </span>
                </label>
              ))}
            </div>

            <label htmlFor="reviewer-note" className="mt-5 block text-xs font-bold text-slate-700">Optional reviewer note</label>
            <textarea id="reviewer-note" value={reviewerNote} onChange={(event) => { setReviewerNote(event.target.value); setReceipt(null); setReceiptEstimate(null); }} rows={3} maxLength={500} placeholder="Add a short note to include with each selected acknowledgement…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700" />
            <p className="mt-1 text-right text-[10px] text-slate-400">{reviewerNote.length}/500</p>
          </section>

          <aside className="space-y-4">
            <section className="surface p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Receipt preview</p>
                  <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">Review summary</h2>
                </div>
                <Clipboard className="h-5 w-5 text-teal-700" />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <SummaryField label="Patient" value={`${patient.name} · ${patient.bed}`} />
                <SummaryField label="Model estimate" value={isLoadingPatient ? 'Loading…' : modelEstimate === null ? 'Unavailable' : `${modelEstimate.toFixed(1)}%`} />
              </dl>
              <p className="mt-3 text-[10px] leading-4 text-slate-500">Estimate is loaded from this patient’s backend model result.</p>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
                <span className="font-semibold text-slate-600">Selected acknowledgements</span>
                <span className="font-mono font-bold text-slate-900">{selectedCount}</span>
              </div>
              <button type="button" onClick={submitReceipt} disabled={isSubmitting || selectedCount === 0} className="primary-action mt-4 w-full disabled:cursor-not-allowed disabled:bg-teal-900/40 disabled:text-white/80 disabled:shadow-none">
                {isSubmitting ? 'Saving simulated receipt…' : <><Check className="h-4 w-4" /> Create review receipt</>}
              </button>
              {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
            </section>

            {receipt && (
              <section className="surface p-5 sm:p-6" aria-labelledby="receipt-title">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div><p className="eyebrow">Saved acknowledgement</p><h2 id="receipt-title" className="mt-1 font-display text-lg font-semibold text-slate-900">Review receipt</h2></div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">{receipt.status === 'SIMULATED_RECEIPT_RECORDED' ? 'Simulated receipt recorded' : receipt.status}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <SummaryField label="Timestamp" value={receipt.timestamp} />
                  <SummaryField label="Reviewer" value={receipt.signed_by} />
                  <SummaryField label="Patient" value={`${patient.name} · ${receipt.patient_id}`} />
                  <SummaryField label="Model estimate" value={receiptEstimate === null ? 'Unavailable' : `${receiptEstimate.toFixed(1)}%`} />
                </dl>
                <div className="mt-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Acknowledgements</h3>
                  <ul className="mt-2 space-y-2">{receipt.orders.map((order, index) => <li key={`${index}-${order}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">{order}</li>)}</ul>
                </div>
                <div className="mt-4 rounded-xl bg-slate-950 p-3 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-300">SHA-256 hash · not a digital signature</p>
                    <button type="button" onClick={copyHash} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-800"><Copy className="h-3 w-3" />{copied ? 'Copied' : 'Copy'}</button>
                  </div>
                  <code className="mt-2 block break-all font-mono text-[10px] leading-4 text-teal-200">{receipt.integrity_signature_sha256}</code>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

const SummaryField = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
    <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-1 break-words text-xs font-semibold text-slate-800">{value}</dd>
  </div>
);
