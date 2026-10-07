import { misprintsFor, type Misprint } from "@/lib/misprints";
import notesSnapshot from "@/data/notes-snapshot.json";
import type { EntryNotes } from "@/lib/notes";
import type { Erratum, MonthOut } from "@/lib/types";

/** One eulogy of an edition's apparatus: where the edition prints it, and what is noted on it. */
export interface ApparatusEntry {
  id: string;
  mm: number;
  dd: number;
  /** Its printed number, if the edition numbers its eulogies, and its asterisk, as this edition prints them. */
  entry: number | null;
  asterisk: boolean;
  /** Printed as a heading, unnumbered. */
  unnumbered: boolean;
  /** Null where the text is redacted. */
  text: string | null;
  /** The curators' notes: on the eulogy (every edition), then on this edition's text. */
  notes: string[];
  /** The misprints the curators verified in this edition's text. */
  misprints: Misprint[];
  /** The corrections the edition prints in its own errata. */
  errata: Erratum[];
}

export type ApparatusKind = "notes" | "misprints" | "errata";

/**
 * Every eulogy of `edition` with a curator's note, a verified misprint or a printed erratum, in the
 * order the edition prints them, from its months (the month endpoint's responses, any order).
 * A note or misprint on an ID this edition does not print is not listed.
 */
export function apparatus(
  edition: string,
  months: MonthOut[],
  notes: Record<string, EntryNotes> = notesSnapshot as Record<string, EntryNotes>,
  misprints: (edition: string, id: string) => Misprint[] = misprintsFor,
): ApparatusEntry[] {
  const out: ApparatusEntry[] = [];
  const seen = new Set<string>();
  for (const m of [...months].sort((a, b) => a.metadata.month - b.metadata.month)) {
    for (const dd of Object.keys(m.days).sort()) {
      for (const e of m.days[dd].elogia) {
        if (!e.id || seen.has(e.id)) continue;
        seen.add(e.id);
        const n = notes[e.id];
        const item: ApparatusEntry = {
          id: e.id,
          mm: m.metadata.month,
          dd: Number(dd),
          entry: e.entry,
          asterisk: e.asterisk,
          unnumbered: e.unnumbered,
          text: e.text,
          notes: [n?.note, n?.editions?.[edition]].filter((x): x is string => Boolean(x)),
          misprints: misprints(edition, e.id),
          errata: e.errata ?? [],
        };
        if (item.notes.length || item.misprints.length || item.errata.length) out.push(item);
      }
    }
  }
  return out;
}

/** How many of the entries carry each kind, and the entries carrying any of `kinds`. */
export function count(entries: ApparatusEntry[], kind: ApparatusKind): number {
  return entries.reduce((n, e) => n + e[kind].length, 0);
}

export function only(entries: ApparatusEntry[], kinds: Set<ApparatusKind>): ApparatusEntry[] {
  return entries.filter((e) => [...kinds].some((k) => e[k].length > 0));
}
