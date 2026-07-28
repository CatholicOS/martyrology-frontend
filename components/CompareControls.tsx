"use client";

import type { EditionOut } from "@/lib/types";

const MONTHS = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12",
];

interface Props {
  editions: EditionOut[];
  editionA: string;
  editionB: string;
  onEditionAChange: (id: string) => void;
  onEditionBChange: (id: string) => void;
  month: string | null;
  onMonthChange: (month: string | null) => void;
}

export default function CompareControls({
  editions,
  editionA,
  editionB,
  onEditionAChange,
  onEditionBChange,
  month,
  onMonthChange,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2 text-sm">
        Edition A
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          value={editionA}
          onChange={(e) => onEditionAChange(e.target.value)}
        >
          <option value="">— select —</option>
          {editions.map((e) => (
            <option key={e.edition_id} value={e.edition_id}>
              {e.edition_id} ({e.year})
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        Edition B
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          value={editionB}
          onChange={(e) => onEditionBChange(e.target.value)}
        >
          <option value="">— select —</option>
          {editions.map((e) => (
            <option key={e.edition_id} value={e.edition_id}>
              {e.edition_id} ({e.year})
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        Month
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          value={month ?? ""}
          onChange={(e) => onMonthChange(e.target.value || null)}
        >
          <option value="">All months</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
