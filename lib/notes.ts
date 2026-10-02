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

const NOTES = snapshot as Record<string, string>;

/**
 * The curators' notes (crmedr's `note`, not part of any printed text) for a page's eulogies, in
 * the order they are printed: the first is marked "†", the second "††", and so on. Daggers, not
 * asterisks, so they are never taken for the printed editions' own notes or asterisked entries. `edition`
 * keeps the anchors apart when two sheets face each other.
 */
export function pageNotes(ids: (string | null)[], edition: string, all: Record<string, string> = NOTES): PageNote[] {
  const seen = new Set<string>();
  const out: PageNote[] = [];
  ids.forEach((id, at) => {
    if (!id || seen.has(id) || !all[id]) return;
    seen.add(id);
    const anchor = `note-${edition}-${id}`;
    out.push({ id, mark: "†".repeat(out.length + 1), note: all[id], anchor, markAnchor: `${anchor}-mark`, at });
  });
  return out;
}
