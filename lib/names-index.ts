import type { Locale } from "@/i18n/routing";
import type { Day } from "@/lib/calendar";
import { compareLines, filingLetter } from "@/lib/places-index";
import type { PersonsSnapshot } from "@/lib/persons";
import type { CatalogEntryOut } from "@/lib/types";

/** One mention: the eulogy, its day and number, its subject in the edition's language, and the footnote the name is printed in (null: the text). */
export interface NameLine {
  id: string;
  day: Day;
  entry: number | null;
  subject: string;
  footnote: number | null;
}

export interface IndexPerson {
  /** The QID; else `name:<name>`, or `name:<name>#<n>@<eulogy>` for the nth (from 2) person of a name in a eulogy. */
  key: string;
  /** The heading: the person's most frequent Latin form. */
  name: string;
  qid: string | null;
  /** The Wikidata label in the interface language, else English; null when it has none. */
  label: string | null;
  /** The label's language: the interface's, or English when it fell back; null with no label. */
  labelLang: Locale | null;
  lines: NameLine[];
}

export interface NamesLetter {
  letter: string;
  persons: IndexPerson[];
  /** Cross-references from other names to their headings, by name. */
  see?: SeeEntry[];
}

/** A cross-reference from a person's other name to their heading: "Mames → see Mamas". */
export interface SeeEntry {
  name: string;
  /** The heading's key. */
  key: string;
  /** The heading's name. */
  target: string;
  /** The heading's letter, whose page holds it. */
  letter: string;
}

export type NamesEntry = { person: IndexPerson } | { see: SeeEntry };

/** A heading's element id, from its key: what an id can't hold becomes "-". */
export function headingId(key: string): string {
  return `p-${key.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

/** A letter's headings and see entries in one order: by name, a heading before a see entry of the same name. */
export function letterEntries(l: NamesLetter): NamesEntry[] {
  const collator = new Intl.Collator("la", { sensitivity: "base" });
  const out: NamesEntry[] = [];
  const see = l.see ?? [];
  let j = 0;
  for (const person of l.persons) {
    while (j < see.length && collator.compare(see[j].name, person.name) < 0) out.push({ see: see[j++] });
    out.push({ person });
  }
  while (j < see.length) out.push({ see: see[j++] });
  return out;
}

export interface NamesIndexData {
  letters: NamesLetter[];
  /** The eulogies the edition prints that name someone. */
  naming: number;
  /** The eulogies the edition prints. */
  printed: number;
}

/** A footnote's element id in the reader (lib/footnotes.ts). */
export function fnAnchor(edition: string, id: string, n: number): string {
  return `fn-${edition}-${id}-${n}`;
}

/**
 * An edition's index of names: the saints and blessed its printed eulogies name, one heading per
 * person (by QID, else by the Latin name, apart for the 2nd, 3rd… of a name in one eulogy) under their most frequent Latin form, sorted and filed by
 * letter in Latin order, each mention in calendar order. Null when crmedr has no persons for the edition.
 */
export function namesIndex(catalog: CatalogEntryOut[], snap: PersonsSnapshot, edition: string, locale: Locale): NamesIndexData | null {
  const byId = snap.editions[edition];
  if (!byId) return null;
  const people = new Map<string, IndexPerson & { forms: Map<string, number>; lineForms: string[] }>();
  let printed = 0;
  let naming = 0;
  /** Each mention's other names, with the heading they refer to. */
  const wanted: { name: string; key: string }[] = [];
  for (const c of catalog) {
    const m = c.present !== false ? /^(\d{2})-(\d{2})$/.exec(c.day_printed ?? "") : null;
    if (!m) continue;
    printed++;
    const mentions = byId[c.id];
    if (!mentions?.length) continue;
    naming++;
    for (const p of mentions) {
      // An unidentified namesake in another eulogy may be the same saint: one heading. The 2nd, 3rd… of a
      // name in one eulogy are other persons: a heading each, its key after the first's (a longer string).
      const key = p.wikidata ?? (p.n ? `name:${p.name}#${p.n}@${c.id}` : `name:${p.name}`);
      for (const v of p.also ?? []) wanted.push({ name: v, key });
      let person = people.get(key);
      if (!person) {
        const l = p.wikidata ? snap.labels[p.wikidata] : undefined;
        const labelLang = l?.[locale] ? locale : l?.en ? "en" : null;
        person = { key, name: p.name, qid: p.wikidata ?? null, label: labelLang && l![labelLang]!, labelLang, lines: [], forms: new Map(), lineForms: [] };
        people.set(key, person);
      }
      person.forms.set(p.name, (person.forms.get(p.name) ?? 0) + 1);
      // One line per eulogy and place: two spellings of one identified person in the same text
      // (or footnote) are one mention, though both count towards the heading's form.
      const footnote = p.where === "text" ? null : p.where.footnote;
      if (person.lines.some((l) => l.id === c.id && l.footnote === footnote)) continue;
      person.lineForms.push(p.name);
      person.lines.push({
        id: c.id,
        day: { mm: Number(m[1]), dd: Number(m[2]) },
        entry: c.entry ?? null,
        subject: c.subject ?? c.id,
        footnote,
      });
    }
  }
  const collator = new Intl.Collator("la", { sensitivity: "base" });
  const persons: IndexPerson[] = [...people.values()].map(({ forms, lineForms, ...p }) => {
    // The heading: the most frequent form; ties, the shorter, then the one first in calendar order.
    const order = p.lines.map((line, i) => ({ line, form: lineForms[i] })).sort((a, b) => compareLines(a.line, b.line));
    p.lines = order.map((o) => o.line);
    const first = (form: string) => order.findIndex((o) => o.form === form);
    const name = [...forms.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || first(a[0]) - first(b[0]))[0][0];
    return { ...p, name };
  });
  persons.sort((a, b) => collator.compare(a.name, b.name) || (a.qid ? 1 : 0) - (b.qid ? 1 : 0) || a.key.localeCompare(b.key));
  const letters: NamesLetter[] = [];
  const byLetter = new Map<string, NamesLetter>();
  for (const p of persons) {
    const letter = filingLetter(p.name, collator);
    let l = byLetter.get(letter);
    if (!l) {
      l = { letter, persons: [] };
      byLetter.set(letter, l);
      letters.push(l);
    }
    l.persons.push(p);
  }
  const heading = new Map(persons.map((p) => [p.key, p]));
  const seen = new Set<string>();
  const see: SeeEntry[] = [];
  for (const w of wanted) {
    const h = heading.get(w.key);
    const id = `${w.name}\u0000${w.key}`;
    if (!h || seen.has(id) || collator.compare(w.name, h.name) === 0) continue;
    seen.add(id);
    see.push({ name: w.name, key: w.key, target: h.name, letter: filingLetter(h.name, collator) });
  }
  see.sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.target, b.target));
  for (const s of see) {
    const letter = filingLetter(s.name, collator);
    let l = byLetter.get(letter);
    if (!l) {
      l = { letter, persons: [] };
      byLetter.set(letter, l);
      letters.push(l);
    }
    (l.see ??= []).push(s);
  }
  // A letter made by see entries alone goes in its place: letters sort by their first name.
  const first = (l: NamesLetter) =>
    [l.persons[0]?.name, l.see?.[0]?.name].filter((n): n is string => !!n).sort(collator.compare)[0];
  letters.sort((a, b) => collator.compare(first(a), first(b)));
  return { letters, naming, printed };
}
