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
  country: string;
  lines: PlaceLine[];
}

export interface IndexLetter {
  letter: string;
  places: IndexPlace[];
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

/** Letters a heading can be filed under; modifier letters (the ʼ of "ʼs-Hertogenbosch") are not. */
const FILING = /[\p{Lu}\p{Ll}\p{Lt}\p{Lo}]/u;

/** The letter a heading is filed under: its first letter, accents folded, upper case; "#" when it starts with a digit or has no letter. */
export function headingLetter(label: string): string {
  const first = [...label.normalize("NFD").replace(/\p{M}/gu, "")].find((c) => FILING.test(c) || /\p{N}/u.test(c));
  return first && FILING.test(first) ? first.toUpperCase() : "#";
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
    const place = ep ? snap.places[ep.place] : undefined;
    if (!ep || !place) continue;
    placed++;
    let p = byPlace.get(ep.place);
    if (!p) {
      p = { qid: ep.place, label: placeLabel(place, ep.place, locale), country: place.country, lines: [] };
      byPlace.set(ep.place, p);
    }
    p.lines.push({
      id: c.id,
      day: { mm: Number(m[1]), dd: Number(m[2]) },
      entry: c.entry ?? null,
      subject: c.subject ?? c.id,
      printed: (form && ep[form]) || null,
      typology: ep.typology,
    });
  }
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const places = [...byPlace.values()].sort((a, b) => collator.compare(a.label, b.label) || a.qid.localeCompare(b.qid));
  const letters: IndexLetter[] = [];
  const byLetter = new Map<string, IndexLetter>();
  for (const p of places) {
    p.lines.sort((a, b) => a.day.mm - b.day.mm || a.day.dd - b.day.dd || (a.entry ?? -Infinity) - (b.entry ?? -Infinity));
    const letter = headingLetter(p.label);
    let l = byLetter.get(letter);
    if (!l) {
      l = { letter, places: [] };
      byLetter.set(letter, l);
      letters.push(l);
    }
    l.places.push(p);
  }
  return { letters, placed, printed };
}
