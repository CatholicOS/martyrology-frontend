import { monthName, type Day } from "@/lib/calendar";
import type { CatalogEntryOut } from "@/lib/types";

/** One eulogy in the reader's subject search: the datalist value and where it is printed. */
export interface SubjectOption {
  value: string;
  id: string;
  day: Day;
}

/**
 * The subject search's options for one edition's catalog: only the eulogies it prints, each
 * labelled with the day it prints them on ("Sanctus Ioannes — 27 December"), since many subjects
 * recur. Two of one subject on one day are told apart by their number, or by their id if unnumbered.
 */
export function subjectOptions(catalog: CatalogEntryOut[]): SubjectOption[] {
  const rows = catalog.flatMap((e) => {
    const m = e.present !== false && e.subject ? /^(\d{2})-(\d{2})$/.exec(e.day_printed ?? "") : null;
    if (!m) return [];
    const day = { mm: Number(m[1]), dd: Number(m[2]) };
    return [{ e, day, base: `${e.subject} — ${day.dd} ${monthName(day.mm, "en")}` }];
  });
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r.base, (seen.get(r.base) ?? 0) + 1);
  return rows
    .sort(
      (x, y) =>
        x.e.subject!.localeCompare(y.e.subject!) ||
        x.day.mm - y.day.mm ||
        x.day.dd - y.day.dd ||
        (x.e.entry ?? Infinity) - (y.e.entry ?? Infinity),
    )
    .map((r) => ({
      value:
        seen.get(r.base)! > 1
          ? `${r.base}, ${r.e.entry !== null && r.e.entry !== undefined ? `n. ${r.e.entry}` : r.e.id}`
          : r.base,
      id: r.e.id,
      day: r.day,
    }));
}

/** The option the search box names: an exact pick from the list, or typed text that fits only one. */
export function findSubject(options: SubjectOption[], text: string): SubjectOption | null {
  const exact = options.find((o) => o.value === text);
  if (exact) return exact;
  const q = text.trim().toLocaleLowerCase();
  if (!q) return null;
  const hits = options.filter((o) => o.value.toLocaleLowerCase().includes(q));
  return hits.length === 1 ? hits[0] : null;
}
