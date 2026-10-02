"use client";

import Link from "next/link";
import { daysInMonth, monthName, todayLocal, type Day } from "@/lib/calendar";

const control = "rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900";

export default function ReaderBar({
  edition,
  day,
  books,
  onGo,
  onSwitch,
  compareWith,
  compareBooks,
  onCompare,
  onSwap,
}: {
  edition: string;
  day: Day;
  books: { id: string; label: string }[];
  onGo: (d: Day, focusId: string) => void;
  onSwitch: (edition: string, focusId: string) => void;
  compareWith: string | null;
  compareBooks: { id: string; label: string }[];
  onCompare: (id: string | null, focusId: string) => void;
  onSwap: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="reader-month">Month</label>
      <select
        id="reader-month"
        className={control}
        value={day.mm}
        onChange={(e) => {
          const mm = Number(e.target.value);
          onGo({ mm, dd: Math.min(day.dd, daysInMonth(mm)) }, "reader-month");
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>{monthName(i + 1, "en")}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="reader-day">Day</label>
      <select id="reader-day" className={control} value={day.dd} onChange={(e) => onGo({ mm: day.mm, dd: Number(e.target.value) }, "reader-day")}>
        {Array.from({ length: daysInMonth(day.mm) }, (_, i) => (
          <option key={i + 1} value={i + 1}>{i + 1}</option>
        ))}
      </select>
      <button type="button" id="reader-today" className={control} onClick={() => onGo(todayLocal(), "reader-today")}>Today</button>
      <label className="sr-only" htmlFor="reader-book">Switch book</label>
      <select id="reader-book" className={`${control} ml-auto`} value={edition} onChange={(e) => onSwitch(e.target.value, "reader-book")}>
        {books.map((b) => (
          <option key={b.id} value={b.id}>{b.label}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="reader-with">Compare with</label>
      <select
        id="reader-with"
        className={control}
        value={compareWith ?? ""}
        onChange={(e) => onCompare(e.target.value || null, "reader-with")}
      >
        <option value="">Compare with…</option>
        {compareBooks.map((b) => (
          <option key={b.id} value={b.id}>{b.label}</option>
        ))}
      </select>
      {compareWith && (
        <>
          <button type="button" id="reader-swap" className={control} aria-label="Swap the two editions" onClick={onSwap}>⇄</button>
          <button type="button" id="reader-close" className={control} aria-label="Close the second edition" onClick={() => onCompare(null, "reader-with")}>×</button>
        </>
      )}
      <Link href="/" className="text-sm underline">⟵ Shelf</Link>
    </div>
  );
}
