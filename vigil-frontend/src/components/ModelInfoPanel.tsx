import React, { useEffect, useState } from 'react';
import { Database, FlaskConical } from 'lucide-react';
import { ModelInfo, fetchModelInfo } from '../services/api';
import { displayFeatureName } from '../constants/clinicalDisplay';

interface ModelInfoPanelProps {
  compact?: boolean;
}

export const ModelInfoPanel: React.FC<ModelInfoPanelProps> = ({ compact = false }) => {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchModelInfo()
      .then((data) => { if (!cancelled) setInfo(data); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Model metrics unavailable.');
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-blue-600" /> Model info
        </h3>
        <p className="mt-2 text-xs text-rose-800">Model metrics could not be loaded from the backend: {error}</p>
        <p className="mt-2 text-xs text-slate-600">Research prototype, not clinically validated.</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-blue-600" /> Model info
        </h3>
        <p className="mt-2 text-xs text-slate-500">Loading model metrics from the backend…</p>
      </div>
    );
  }

  const rows: [string, string][] = [
    ['Training dataset', info.dataset],
    ['Patients used', `${info.n_patients_used} (train+val ${info.n_train} / holdout ${info.n_test})`],
    ['AUROC (holdout)', info.auroc.toFixed(2)],
    ['Holdout positives', info.test_positive_count === undefined ? 'Not reported' : `${info.test_positive_count} of ${info.n_test}`],
    ['Average precision', info.average_precision.toFixed(4)],
    ['Brier score', info.brier_score.toFixed(4)],
    ['Positive rate', `${(info.positive_rate * 100).toFixed(2)}%`],
    ['Calibration', info.calibration],
    ['Model features', info.feature_list.map(displayFeatureName).join(', ')],
    ['Metrics recorded', formatDate(info.date)],
  ];
  if (info.auroc_ci95) rows.splice(3, 0, ['AUROC 95% bootstrap CI', `${info.auroc_ci95[0].toFixed(2)}–${info.auroc_ci95[1].toFixed(2)}`]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" /> Model info
        </h3>
        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
          Research prototype
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
            <dt className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-500 sm:w-48 sm:shrink-0">{label}</dt>
            <dd className="text-xs text-slate-800 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[11px] leading-relaxed text-slate-600 border-t border-slate-100 pt-3">
        {compact ? 'All metrics above are served by the backend from app/ml_engine/metrics.json. ' : ''}
        Research prototype, not clinically validated. These are holdout benchmark numbers on public de-identified
        PhysioNet data, not bedside performance.
      </p>
    </div>
  );
};

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const monthName = new Date(Number(year), Number(month) - 1, Number(day)).toLocaleString('en-GB', { month: 'short' });
  return `${Number(day)} ${monthName} ${year}`;
}
