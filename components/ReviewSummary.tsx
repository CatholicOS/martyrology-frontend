"use client";

interface Summary {
  accepted: number;
  rejected: number;
  edited: number;
  undecided: number;
}

interface Props {
  summary: Summary;
  onExport: () => void;
}

export default function ReviewSummary({ summary, onExport }: Props) {
  const total = summary.accepted + summary.rejected + summary.edited + summary.undecided;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
      <span>
        <strong>{total}</strong> total
      </span>
      <span className="text-green-700 dark:text-green-400">{summary.accepted} accepted</span>
      <span className="text-red-700 dark:text-red-400">{summary.rejected} rejected</span>
      <span className="text-amber-700 dark:text-amber-400">{summary.edited} edited</span>
      <span className="text-slate-500 dark:text-slate-400">{summary.undecided} undecided</span>
      <button
        type="button"
        className="ml-auto rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
        onClick={onExport}
      >
        Export decisions
      </button>
    </div>
  );
}
