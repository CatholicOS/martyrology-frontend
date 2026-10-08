"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("Review.summary");
  const total = summary.accepted + summary.rejected + summary.edited + summary.undecided;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
      <span>
        {t.rich("total", { count: total, b: (chunks) => <strong>{chunks}</strong> })}
      </span>
      <span className="text-green-700 dark:text-green-400">{t("accepted", { count: summary.accepted })}</span>
      <span className="text-red-700 dark:text-red-400">{t("rejected", { count: summary.rejected })}</span>
      <span className="text-amber-700 dark:text-amber-400">{t("edited", { count: summary.edited })}</span>
      <span className="text-slate-500 dark:text-slate-400">{t("undecided", { count: summary.undecided })}</span>
      <button
        type="button"
        className="ml-auto rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
        onClick={onExport}
      >
        {t("export")}
      </button>
    </div>
  );
}
