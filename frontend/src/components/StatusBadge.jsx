const STYLES = {
  Draft: 'bg-slate-100 text-slate-700 ring-slate-300',
  Pending: 'bg-amber-50 text-amber-800 ring-amber-300',
  Approved: 'bg-blue-50 text-blue-700 ring-blue-300',
  Shipped: 'bg-indigo-50 text-indigo-700 ring-indigo-300',
  Delivered: 'bg-green-50 text-green-700 ring-green-300',
  Cancelled: 'bg-red-50 text-red-700 ring-red-300',
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STYLES[status] ?? STYLES.Draft
      }`}
    >
      {status}
    </span>
  );
}
