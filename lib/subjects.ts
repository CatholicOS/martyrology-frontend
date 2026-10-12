import { interfaceMonth, type Day } from "@/lib/calendar";
import { fold } from "@/lib/fold";
import type { CatalogEntryOut } from "@/lib/types";

/** One eulogy in the reader's subject search: the suggestion's label and where it is printed. */
export interface SubjectOption {
  value: string;
  id: string;
  day: Day;
  /** The eulogy's subject in its other languages, searched with the label: "Ioannes a Cruce" finds "Saint John of the Cross". */
  also?: string[];
}

/**
 * The subject search's options for one edition's catalog: only the eulogies it prints, each
 * labelled with the day it prints them on ("Sanctus Ioannes — 27 December"), since many subjects
 * recur, the month in the interface language. Two of one subject on one day are told apart by their number, or by their id if unnumbered.
 */
export function subjectOptions(catalog: CatalogEntryOut[], format: Parameters<typeof interfaceMonth>[0],
  /** The subject to show for an eulogy (the interface language's); the catalog's own by default. */
  subjectOf: (id: string, catalogSubject: string) => string = (_id, own) => own,
  /** The eulogy's subjects in every language, searched besides its label; none by default. */
  alsoOf?: (id: string, catalogSubject: string) => string[],
): SubjectOption[] {
  const rows = catalog.flatMap((e) => {
    const m = e.present !== false && e.subject ? /^(\d{2})-(\d{2})$/.exec(e.day_printed ?? "") : null;
    if (!m) return [];
    const day = { mm: Number(m[1]), dd: Number(m[2]) };
    const subject = subjectOf(e.id, e.subject!);
    return [{ e, subject, day, base: `${subject} — ${day.dd} ${interfaceMonth(format, day.mm)}` }];
  });
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r.base, (seen.get(r.base) ?? 0) + 1);
  return rows
    .sort(
      (x, y) =>
        x.subject.localeCompare(y.subject) ||
        x.day.mm - y.day.mm ||
        x.day.dd - y.day.dd ||
        (x.e.entry ?? Infinity) - (y.e.entry ?? Infinity),
    )
    .map((r) => {
      const option: SubjectOption = {
        value:
          seen.get(r.base)! > 1
            ? `${r.base}, ${r.e.entry !== null && r.e.entry !== undefined ? `n. ${r.e.entry}` : r.e.id}`
            : r.base,
        id: r.e.id,
        day: r.day,
      };
      if (alsoOf) {
        const also = [...new Set(alsoOf(r.e.id, r.e.subject!).map((s) => s.trim()).filter((s) => s && s !== r.subject))];
        if (also.length) option.also = also;
      }
      return option;
    });
}

/** How many suggestions the subject search lists at most. */
export const SUGGESTION_LIMIT = 50;

/**
 * The options whose label, or subject in another language (`also`), holds the typed text, accents,
 * marks and case aside (see `fold`), in the options' own order, the first `limit` of them; with
 * nothing typed, the first `limit` options.
 */
export function matchSubjects(options: SubjectOption[], text: string, limit = SUGGESTION_LIMIT): SubjectOption[] {
  const q = fold(text.trim());
  const hits: SubjectOption[] = [];
  for (const o of options) {
    if (hits.length >= limit) break;
    if (!q || fold(o.value).includes(q) || o.also?.some((s) => fold(s).includes(q))) hits.push(o);
  }
  return hits;
}

/** The option the search box names: an exact pick from the list, or typed text that fits only one, accents and marks aside. */
export function findSubject(options: SubjectOption[], text: string): SubjectOption | null {
  const exact = options.find((o) => o.value === text);
  if (exact) return exact;
  if (!text.trim()) return null;
  const hits = matchSubjects(options, text, 2);
  return hits.length === 1 ? hits[0] : null;
}

/** The subject languages crmedr publishes; add a code here when crmedr adds its file. */
export const SUBJECT_LANGS = ["la", "it", "en"] as const;

/** A subject for the interface: the reader's language if crmedr has it, else English, else Latin, else the ID. */
export function subjectFor(subject: Partial<Record<string, string | null>> | undefined, locale: string, id = ""): string {
  const pick = (l: string) => ((SUBJECT_LANGS as readonly string[]).includes(l) ? subject?.[l]?.trim() : "") || "";
  return pick(locale) || pick("en") || pick("la") || id;
}
