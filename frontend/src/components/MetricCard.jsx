import { useId } from 'react';

const ACCENTS = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  red: 'bg-red-50 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
};

/**
 * A dashboard summary card. Pure display: it re-renders whenever the page passes new data.
 * Exposed as a named group (role="group", named by its label) for assistive technology.
 */
export default function MetricCard({ label, value, hint, icon, accent = 'blue' }) {
  const labelId = useId();
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <p id={labelId} className="text-sm font-medium text-slate-600">
          {label}
        </p>
        {icon && (
          <span
            aria-hidden="true"
            className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-semibold ${ACCENTS[accent] ?? ACCENTS.blue}`}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
