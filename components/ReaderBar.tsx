"use client";

import { Link } from "@/i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { daysInMonth, interfaceMonth, todayLocal, type Day } from "@/lib/calendar";
import { hasPersons } from "@/lib/persons-editions";
import { returnQuery } from "@/lib/reader-return";
import { findSubject, matchSubjects, type SubjectOption } from "@/lib/subjects";

const control = "rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900";

/** A switch of the reader bar: a checkbox announced as a switch, drawn as a sliding knob. */
function Switch({ id, label, title, checked, onChange }: {
  id: string; label: string; title: string; checked: boolean; onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-sm" title={title}>
      <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={
          "relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors dark:bg-slate-600 " +
          "peer-checked:bg-[#0b6e7f] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0b6e7f]/50 " +
          "after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white " +
          "after:shadow after:transition-transform peer-checked:after:translate-x-4"
        }
      />
      {label}
    </label>
  );
}

/** The id of the subject search's i-th suggestion, which `aria-activedescendant` names while it is highlighted. */
const optionId = (i: number) => `reader-subjects-${i}`;

/**
 * The subject search: a combobox with a listbox of suggestions (the WAI-ARIA 1.2 pattern), which
 * holds the subjects whose label has the typed text, with or without its accents and marks. The
 * arrow keys move through them, Enter picks the highlighted one (with none highlighted, the only
 * one the text fits), Escape closes them.
 */
function SubjectSearch({ subjects, onFind }: { subjects: SubjectOption[] | null; onFind: (o: SubjectOption) => void }) {
  const t = useTranslations("Reader");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = useMemo(() => (subjects ? matchSubjects(subjects, query) : []), [subjects, query]);
  const expanded = open && matches.length > 0;
  // Keep the highlighted suggestion in view as the arrows move through a long list.
  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
  }, [active]);
  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const pick = (o: SubjectOption | null) => {
    if (!o) return;
    setQuery("");
    close();
    onFind(o);
  };
  /** Moves the highlight one step (wrapping), opening the list first if it is closed. */
  const move = (step: 1 | -1) => {
    if (matches.length === 0) return;
    if (!expanded) {
      setOpen(true);
      setActive(step === 1 ? 0 : matches.length - 1);
    } else {
      setActive(step === 1 ? (active + 1) % matches.length : active <= 0 ? matches.length - 1 : active - 1);
    }
  };
  return (
    <div className="relative min-w-40 max-w-xs flex-1">
      <label className="sr-only" htmlFor="reader-subject">{t("findLabel")}</label>
      <input
        id="reader-subject"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls="reader-subjects"
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        className={`${control} w-full`}
        placeholder={subjects ? t("findPlaceholder") : t("findLoading")}
        disabled={!subjects}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onBlur={close}
        onKeyDown={(e) => {
          // Keys that confirm an input method's composition (Japanese, Chinese, Vietnamese…) are not ours.
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            move(e.key === "ArrowDown" ? 1 : -1);
          } else if (e.key === "Enter" && subjects) {
            e.preventDefault();
            pick(expanded && active >= 0 ? matches[active] : findSubject(subjects, query));
          } else if (e.key === "Escape" && expanded) {
            // Only closes the list; a second Escape clears the box, as a search box does.
            e.preventDefault();
            close();
          }
        }}
      />
      <ul
        id="reader-subjects"
        role="listbox"
        aria-label={t("findSuggestions")}
        hidden={!expanded}
        className="absolute left-0 top-full z-20 mt-1 max-h-72 w-full min-w-64 overflow-y-auto rounded border border-slate-300 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        {expanded && matches.map((o, i) => (
          <li
            key={o.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            className={`cursor-pointer px-2 py-1 ${i === active ? "bg-[#0b6e7f] text-white" : ""}`}
            // Keep the focus in the box, so the click picks rather than blurring the list away.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(o)}
          >
            {o.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  markupAvailable,
  markup,
  onMarkup,
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
  /** Whether the day on screen names anyone or anywhere: the "Names & places" switch is drawn only then. */
  markupAvailable: boolean;
  markup: boolean;
  onMarkup: (on: boolean) => void;
}) {
  const t = useTranslations("Reader");
  const tm = useTranslations("Markup");
  const format = useFormatter();
  // The views carry the day and the comparison, so that their links back to the reader return here.
  const view = (path: string) => `/read/${encodeURIComponent(edition)}/${path}${returnQuery({ day, with: compareWith })}`;
  return (
    <div className="mb-4 flex flex-col gap-3 px-4 sm:px-0">
      {/* First, like breadcrumbs: the shelf, then the edition's other views, each marked as leading away. */}
      <nav aria-label={t("views")} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Link href="/" className="underline">{t("shelf")}</Link>
        <Link href={view("notes")} className="underline">
          {t("notesLink")}<span aria-hidden> →</span>
        </Link>
        <Link href={view("places")} className="underline">
          {t("placesLink")}<span aria-hidden> →</span>
        </Link>
        {hasPersons(edition) && (
          <Link href={view("names")} className="underline">
            {t("namesLink")}<span aria-hidden> →</span>
          </Link>
        )}
      </nav>
      {/* The editions. Phones: the pickers stacked, × beside the second, ⇄ beside the pair. Wider: in a row,
          [edition] ⇄ [compare with] ×, which is also the focus order. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:flex sm:flex-wrap">
        <label className="sr-only" htmlFor="reader-book">{t("switchBook")}</label>
        <select id="reader-book" className={`${control} col-start-1 row-start-1 w-full min-w-0 sm:w-auto`} value={edition} onChange={(e) => onSwitch(e.target.value, "reader-book")}>
          {books.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
        {compareWith && (
          <button type="button" id="reader-swap" className={`${control} col-start-3 row-span-2 row-start-1`} aria-label={t("swap")} onClick={onSwap}>⇄</button>
        )}
        <label className="sr-only" htmlFor="reader-with">{t("compareWith")}</label>
        <select
          id="reader-with"
          className={`${control} col-start-1 row-start-2 w-full min-w-0 sm:w-auto`}
          value={compareWith ?? ""}
          onChange={(e) => onCompare(e.target.value || null, "reader-with")}
        >
          <option value="">{t("compareWithPlaceholder")}</option>
          {compareBooks.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
        {compareWith && (
          <button type="button" id="reader-close" className={`${control} col-start-2 row-start-2`} aria-label={t("closeSecond")} onClick={() => onCompare(null, "reader-with")}>×</button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
        <SubjectSearch subjects={subjects} onFind={onFind} />
        <Switch id="reader-ids" label={t("ids")} title={t("showIdsTitle")} checked={showIds} onChange={onShowIds} />
        {markupAvailable && (
          <Switch id="reader-markup" label={tm("switch")} title={tm("switchTitle")} checked={markup} onChange={onMarkup} />
        )}
      </div>
    </div>
  );
}
