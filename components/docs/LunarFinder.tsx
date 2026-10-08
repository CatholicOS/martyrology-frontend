"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { getDay } from "@/lib/api";
import type { DocLang } from "@/lib/docs";
import type { LunaAnnouncement } from "@/lib/types";

const EDITION = "martyrologium_romanum_2004";

const T: Record<DocLang, Record<"date" | "golden" | "epact" | "letter" | "moon" | "reader" | "failed" | "loading", string>> = {
  en: { date: "Date", golden: "Golden number", epact: "Epact", letter: "Letter of the Martyrology", moon: "Moon to announce",
        reader: "Open this day in the reader", failed: "The moon couldn't be loaded.", loading: "Loading…" },
  it: { date: "Data", golden: "Numero aureo", epact: "Epatta", letter: "Lettera del Martirologio", moon: "Luna da enunciare",
        reader: "Apri questo giorno nel lettore", failed: "Non è stato possibile caricare la luna.", loading: "Caricamento…" },
};

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
export function LunarFinder({ lang }: { lang: DocLang }) {
  const t = T[lang];
  const inputId = useId();
  const [value, setValue] = useState("");
  const [state, setState] = useState<{ for: string; luna?: LunaAnnouncement | null; failed?: boolean } | null>(null);
  const date = parseDate(value);

  useEffect(() => {
    if (!date) return;
    let live = true;
    getDay(EDITION, date.mm, date.dd, date.year).then(
      (day) => live && setState({ for: value, luna: day.luna?.annuntiatio ?? null }),
      () => live && setState({ for: value, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- `date` derives from `value`

  const shown = date && state?.for === value ? state : null;
  return (
    <div className="my-6 rounded border border-slate-200 p-4 dark:border-slate-800">
      <label htmlFor={inputId} className="mr-2">{t.date}</label>
      <input id={inputId} type="date" value={value} onChange={(e) => setValue(e.target.value)}
             className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900" />
      {date && !shown && <p className="mt-3 text-sm">{t.loading}</p>}
      {shown?.failed && <p className="mt-3 text-sm">{t.failed}</p>}
      {shown?.luna && (
        <>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt>{t.golden}</dt><dd>{shown.luna.golden_number}</dd>
            <dt>{t.epact}</dt><dd>{shown.luna.epact}</dd>
            <dt>{t.letter}</dt><dd>{shown.luna.letter}</dd>
            <dt>{t.moon}</dt><dd lang="la" className="italic">{shown.luna.pronuntiatio}</dd>
          </dl>
          <p className="mt-3 text-sm">
            <Link href={`/read/${EDITION}/${date!.mm}/${date!.dd}`} className="underline">{t.reader}</Link>
          </p>
        </>
      )}
    </div>
  );
}
