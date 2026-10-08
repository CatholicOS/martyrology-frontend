"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useEffect, useId, useState } from "react";
import { getDay } from "@/lib/api";
import type { LunaAnnouncement } from "@/lib/types";

const EDITION = "martyrologium_romanum_2004";
/** The first year of the Gregorian calendar, whose computus the lunar table follows; the API announces no moon before it. */
const FIRST_YEAR = 1583;
/** How long the finder waits for the API before saying the moon couldn't be loaded. */
const TIMEOUT_MS = 15_000;

/** "2005-01-01" → { year: 2005, mm: "01", dd: "01" }; null for an empty or partial value or year 0. */
function parseDate(v: string): { year: number; mm: string; dd: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m || Number(m[1]) < 1) return null;
  return { year: Number(m[1]), mm: m[2], dd: m[3] };
}

/**
 * Pick a date: the year's golden number, epact and Martyrology letter, and the moon the 2004 edition
 * announces on that day, as the API computes them (the page explains the method; this does not redo it).
 */
export function LunarFinder() {
  const t = useTranslations("Docs.finder");
  const inputId = useId();
  const [value, setValue] = useState("");
  const [state, setState] = useState<{ for: string; luna?: LunaAnnouncement | null; failed?: boolean } | null>(null);
  const parsed = parseDate(value);
  // A year below 1583 is either still being typed (the field reports "0002", "0020", "0201" on the way to
  // "2015") or before the table: neither is asked for.
  const early = parsed !== null && parsed.year < FIRST_YEAR;
  const date = early ? null : parsed;

  useEffect(() => {
    if (!date) return;
    let live = true;
    const controller = new AbortController();
    // A request that never settles would leave "Loading…" up for good: abort it and say it failed.
    const timer = setTimeout(() => {
      controller.abort();
      if (live) setState({ for: value, failed: true });
      live = false;
    }, TIMEOUT_MS);
    const settle = (next: NonNullable<typeof state>) => {
      clearTimeout(timer);
      if (live) setState(next);
    };
    getDay(EDITION, date.mm, date.dd, date.year, { signal: controller.signal }).then(
      // No `luna` at all (an API before v0.15.0) is a failure to load; `annuntiatio: null` is the book announcing no moon.
      (day) => settle(day.luna ? { for: value, luna: day.luna.annuntiatio } : { for: value, failed: true }),
      () => settle({ for: value, failed: true }),
    );
    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- `date` derives from `value`

  const shown = date && state?.for === value ? state : null;
  return (
    <div className="my-6 rounded border border-slate-200 p-4 dark:border-slate-800">
      <label htmlFor={inputId} className="mr-2">{t("date")}</label>
      <input id={inputId} type="date" min="1583-01-01" value={value} onChange={(e) => setValue(e.target.value)}
             className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900" />
      {/* Always rendered, so a screen reader announces whatever appears in it once a date is picked. */}
      <div role="status">
        {early && <p className="mt-3 text-sm">{t("early")}</p>}
        {date && !shown && <p className="mt-3 text-sm">{t("loading")}</p>}
        {shown && !shown.failed && !shown.luna && <p className="mt-3 text-sm">{t("none")}</p>}
        {shown?.failed && <p className="mt-3 text-sm">{t("failed")}</p>}
        {shown?.luna && (
          <>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt>{t("golden")}</dt><dd>{shown.luna.golden_number}</dd>
              <dt>{t("epact")}</dt><dd>{shown.luna.epact}</dd>
              <dt>{t("letter")}</dt><dd>{shown.luna.letter}</dd>
              <dt>{t("moon")}</dt><dd lang="la" className="italic">{shown.luna.pronuntiatio}</dd>
            </dl>
            <p className="mt-3 text-sm">
              <Link href={`/read/${EDITION}/${date!.mm}/${date!.dd}`} className="underline">{t("reader")}</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
