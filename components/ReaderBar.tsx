"use client";

import { Link } from "@/i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { daysInMonth, interfaceMonth, todayLocal, type Day } from "@/lib/calendar";
import { hasPersons } from "@/lib/persons-editions";
import { findSubject, type SubjectOption } from "@/lib/subjects";

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
  subjects,
  onFind,
  showIds,
  onShowIds,
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
  /** The current book's eulogies for the subject search; null while loading or unavailable. */
  subjects: SubjectOption[] | null;
  onFind: (o: SubjectOption) => void;
  showIds: boolean;
  onShowIds: (on: boolean) => void;
}) {
  const t = useTranslations("Reader");
  const format = useFormatter();
  const [query, setQuery] = useState("");
  const pick = (o: SubjectOption | null) => {
    if (!o) return false;
    setQuery("");
    onFind(o);
    return true;
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 px-4 sm:px-0">
      <label className="sr-only" htmlFor="reader-month">{t("month")}</label>
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
          <option key={i + 1} value={i + 1}>{interfaceMonth(format, i + 1)}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="reader-day">{t("day")}</label>
      <select id="reader-day" className={control} value={day.dd} onChange={(e) => onGo({ mm: day.mm, dd: Number(e.target.value) }, "reader-day")}>
        {Array.from({ length: daysInMonth(day.mm) }, (_, i) => (
          <option key={i + 1} value={i + 1}>{i + 1}</option>
        ))}
      </select>
      <button type="button" id="reader-today" className={control} onClick={() => onGo(todayLocal(), "reader-today")}>{t("today")}</button>
      <label className="sr-only" htmlFor="reader-subject">{t("findLabel")}</label>
      <input
        id="reader-subject"
        type="search"
        list="reader-subjects"
        autoComplete="off"
        className={`${control} min-w-40 max-w-xs flex-1`}
        placeholder={subjects ? t("findPlaceholder") : t("findLoading")}
        disabled={!subjects}
        value={query}
        onChange={(e) => {
          const text = e.target.value;
          // A pick from the list arrives as its whole value; typing waits for Enter.
          const hit = subjects?.find((o) => o.value === text) ?? null;
          if (!pick(hit)) setQuery(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && subjects) {
            e.preventDefault();
            pick(findSubject(subjects, query));
          }
        }}
      />
      <datalist id="reader-subjects">
        {subjects?.map((o) => <option key={o.id} value={o.value} />)}
      </datalist>
      <label className="sr-only" htmlFor="reader-book">{t("switchBook")}</label>
      <select id="reader-book" className={`${control} ml-auto`} value={edition} onChange={(e) => onSwitch(e.target.value, "reader-book")}>
        {books.map((b) => (
          <option key={b.id} value={b.id}>{b.label}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="reader-with">{t("compareWith")}</label>
      <select
        id="reader-with"
        className={control}
        value={compareWith ?? ""}
        onChange={(e) => onCompare(e.target.value || null, "reader-with")}
      >
        <option value="">{t("compareWithPlaceholder")}</option>
        {compareBooks.map((b) => (
          <option key={b.id} value={b.id}>{b.label}</option>
        ))}
      </select>
      {compareWith && (
        <>
          <button type="button" id="reader-swap" className={control} aria-label={t("swap")} onClick={onSwap}>⇄</button>
          <button type="button" id="reader-close" className={control} aria-label={t("closeSecond")} onClick={() => onCompare(null, "reader-with")}>×</button>
        </>
      )}
      <label className="flex cursor-pointer items-center gap-1.5 text-sm" title={t("showIdsTitle")}>
        <input
          id="reader-ids"
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={showIds}
          onChange={(e) => onShowIds(e.target.checked)}
        />
        <span
          aria-hidden
          className={
            "relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors dark:bg-slate-600 " +
            "peer-checked:bg-[#0b6e7f] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0b6e7f]/50 " +
            "after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white " +
            "after:shadow after:transition-transform peer-checked:after:translate-x-4"
          }
        />
        {t("ids")}
      </label>
      <Link href={`/read/${encodeURIComponent(edition)}/notes`} className="text-sm underline">
        {t("notesLink")}
      </Link>
      <Link href={`/read/${encodeURIComponent(edition)}/places`} className="text-sm underline">
        {t("placesLink")}
      </Link>
      {hasPersons(edition) && (
        <Link href={`/read/${encodeURIComponent(edition)}/names`} className="text-sm underline">
          {t("namesLink")}
        </Link>
      )}
      <Link href="/" className="text-sm underline">{t("shelf")}</Link>
    </div>
  );
}
