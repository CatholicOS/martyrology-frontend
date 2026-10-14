import type { Locale } from "@/i18n/routing";
import type { Day } from "@/lib/calendar";
import type { PlaceInfo, PlacesSnapshot } from "@/lib/places";
import type { CatalogEntryOut } from "@/lib/types";

/** One eulogy under a place: its day, number, subject in the edition's language, the place as the edition prints it, and its typology. */
export interface PlaceLine {
  id: string;
  day: Day;
  entry: number | null;
  subject: string;
  printed: string | null;
  typology: string | null;
}

export interface IndexPlace {
  qid: string;
  label: string;
  /** The label's language: the interface's, or English when it fell back; null when the heading is the QID. */
  labelLang: Locale | null;
  country: string;
  lines: PlaceLine[];
}

export interface IndexLetter {
  letter: string;
  places: IndexPlace[];
  /** Cross-references from a place's other printed names to its heading, by name. */
  see?: PlaceSee[];
}

/** A cross-reference from a place's other printed name to its heading: "Oświęcim → see Auschwitz". */
export interface PlaceSee {
  /** The name as the Latin prints it, in the nominative. */
  name: string;
  /** The heading's place. */
  qid: string;
  /** The heading's label. */
  target: string;
  /** The heading's language, as IndexPlace.labelLang. */
  targetLang: Locale | null;
  /** The heading's letter, whose page holds it. */
  letter: string;
}

export type PlacesEntry = { place: IndexPlace } | { see: PlaceSee };

/** A place heading's element id, which its cross-references link to. */
export function placeHeadingId(qid: string): string {
  return `pl-${qid.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

/** A letter's headings and cross-references in one order: by name, a heading before a cross-reference of the same name. */
export function placeLetterEntries(l: IndexLetter, locale: Locale): PlacesEntry[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const out: PlacesEntry[] = [];
  const see = l.see ?? [];
  let j = 0;
  for (const place of l.places) {
    while (j < see.length && collator.compare(see[j].name, place.label) < 0) out.push({ see: see[j++] });
    out.push({ place });
  }
  while (j < see.length) out.push({ see: see[j++] });
  return out;
}

export interface PlacesIndexData {
  letters: IndexLetter[];
  /** The eulogies the edition prints that have a place. */
  placed: number;
  /** The eulogies the edition prints. */
  printed: number;
}

/** Which printed form of a place is the edition's own: the snapshot's forms come from these two editions' texts. */
const PRINTED_FORM: Record<string, "la" | "it"> = {
  martyrologium_romanum_2004: "la",
  martyrologium_romanum_2004_it_IT: "it",
};

/** A place's heading: its label in the interface language, else in English, else the gazetteer's, else its QID. */
export function placeLabel(place: PlaceInfo, qid: string, locale: Locale): string {
  return place.labels?.[locale] || place.labels?.en || place.label || qid;
}

/** The language of `placeLabel`'s heading: the gazetteer's own label is English; a QID has none. */
export function placeLabelLang(place: PlaceInfo, locale: Locale): Locale | null {
  if (place.labels?.[locale]) return locale;
  return place.labels?.en || place.label ? "en" : null;
}

/** Letters a heading can be filed under; modifier letters (the ʼ of "ʼs-Hertogenbosch") are not. */
const FILING = /[\p{Lu}\p{Ll}\p{Lt}\p{Lo}]/u;

/** The letter a heading is filed under: its first letter, accents folded, upper case; "#" when it starts with a digit or has no letter. */
export function headingLetter(label: string): string {
  const first = [...label.normalize("NFD").replace(/\p{M}/gu, "")].find((c) => FILING.test(c) || /\p{N}/u.test(c));
  return first && FILING.test(first) ? first.toUpperCase() : "#";
}

/** Calendar order: by day, then the unnumbered first on their day (as printed), then by number. */
export function compareLines(a: { day: Day; entry: number | null }, b: { day: Day; entry: number | null }): number {
  if (a.day.mm !== b.day.mm) return a.day.mm - b.day.mm;
  if (a.day.dd !== b.day.dd) return a.day.dd - b.day.dd;
  if (a.entry === b.entry) return 0;
  if (a.entry === null) return -1;
  if (b.entry === null) return 1;
  return a.entry - b.entry;
}

const AZ = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/**
 * The letter a heading is filed under, by the same collator that sorts the headings: a Latin letter
 * the fold leaves whole (Đ, Ł, Æ) goes under the A–Z letter it sorts with (D, L, A).
 */
export function filingLetter(label: string, collator: Intl.Collator): string {
  const letter = headingLetter(label);
  if (letter === "#" || AZ.includes(letter) || !/\p{Script=Latin}/u.test(letter)) return letter;
  return [...AZ].reverse().find((l) => collator.compare(letter, l) >= 0) ?? letter;
}

/**
 * An edition's index of places: the eulogies it prints (its catalog's `present` entries with a
 * printed day) that have a place, grouped by place, the places sorted in the interface language and
 * filed by letter, each place's eulogies in calendar order, the unnumbered first on their day as
 * printed. `placed` and `printed` count the eulogies for the coverage note.
 */
export function placesIndex(catalog: CatalogEntryOut[], snap: PlacesSnapshot, edition: string, locale: Locale): PlacesIndexData {
  const form = PRINTED_FORM[edition];
  const byPlace = new Map<string, IndexPlace>();
  let printed = 0;
  let placed = 0;
  for (const c of catalog) {
    const m = c.present !== false ? /^(\d{2})-(\d{2})$/.exec(c.day_printed ?? "") : null;
    if (!m) continue;
    printed++;
    const ep = snap.eulogies[c.id];
    const first = ep?.places[0];
    const place = first ? snap.places[first.place] : undefined;
    if (!ep || !first || !place) continue;
    placed++;
    let p = byPlace.get(first.place);
    if (!p) {
      p = { qid: first.place, label: placeLabel(place, first.place, locale), labelLang: placeLabelLang(place, locale), country: place.country, lines: [] };
      byPlace.set(first.place, p);
    }
    p.lines.push({
      id: c.id,
      day: { mm: Number(m[1]), dd: Number(m[2]) },
      entry: c.entry ?? null,
      subject: c.subject ?? c.id,
      printed: (form && first[form]) || null,
      typology: ep.typology,
    });
  }
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const places = [...byPlace.values()].sort((a, b) => collator.compare(a.label, b.label) || a.qid.localeCompare(b.qid));
  const letters: IndexLetter[] = [];
  const byLetter = new Map<string, IndexLetter>();
  for (const p of places) {
    p.lines.sort(compareLines);
    const letter = filingLetter(p.label, collator);
    let l = byLetter.get(letter);
    if (!l) {
      l = { letter, places: [] };
      byLetter.set(letter, l);
      letters.push(l);
    }
    l.places.push(p);
  }
  // Each other name the Latin prints for a place leads to its heading, unless it is the heading.
  const see: PlaceSee[] = [];
  for (const p of places) {
    for (const name of snap.places[p.qid]?.also ?? []) {
      if (collator.compare(name, p.label) === 0 || see.some((s) => s.qid === p.qid && collator.compare(s.name, name) === 0)) continue;
      see.push({ name, qid: p.qid, target: p.label, targetLang: p.labelLang, letter: filingLetter(p.label, collator) });
    }
  }
  see.sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.target, b.target));
  for (const s of see) {
    const letter = filingLetter(s.name, collator);
    let l = byLetter.get(letter);
    if (!l) {
      l = { letter, places: [] };
      byLetter.set(letter, l);
      letters.push(l);
    }
    (l.see ??= []).push(s);
  }
  // A letter made by cross-references alone goes in its place: letters sort by their first name.
  const first = (l: IndexLetter) =>
    [l.places[0]?.label, l.see?.[0]?.name].filter((n): n is string => !!n).sort(collator.compare)[0];
  letters.sort((a, b) => collator.compare(first(a), first(b)));
  return { letters, placed, printed };
}
