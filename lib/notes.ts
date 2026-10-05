import snapshot from "@/data/notes-snapshot.json";

/** One curator's note set as a footnote on a page: "†", "††", … in page order. */
export interface PageNote {
  id: string;
  mark: string;
  note: string;
  /** The footnote's element id. */
  anchor: string;
  /** The element id of its mark in the text, for the link back. */
  markAnchor: string;
  /** Where the noted eulogy first comes in the page's list: only that one carries the mark. */
  at: number;
}

/** An entry's curators' notes: on the eulogy (every edition), and on one edition's text (that edition only). */
export interface EntryNotes {
  note?: string;
  editions?: Record<string, string>;
}

const NOTES = snapshot as Record<string, EntryNotes>;

/**
 * The curators' notes (crmedr's `note` and this edition's `edition_notes`, not part of any printed text) for a page's eulogies, in
 * the order they are printed: the first is marked "†", the second "††", and so on. Daggers, not
 * asterisks, so they are never taken for the printed editions' own notes or asterisked entries. `edition`
 * keeps the anchors apart when two sheets face each other.
 */
export function pageNotes(ids: (string | null)[], edition: string, all: Record<string, EntryNotes> = NOTES): PageNote[] {
  const seen = new Set<string>();
  const out: PageNote[] = [];
  ids.forEach((id, at) => {
    if (!id || seen.has(id)) return;
    // The eulogy's note, then this edition's: a note on another edition's text does not show here.
    const note = [all[id]?.note, all[id]?.editions?.[edition]].filter(Boolean).join(" ");
    if (!note) return;
    seen.add(id);
    const anchor = `note-${edition}-${id}`;
    out.push({ id, mark: "†".repeat(out.length + 1), note, anchor, markAnchor: `${anchor}-mark`, at });
  });
  return out;
}
