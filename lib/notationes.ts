import type { AttachNoteOp, DecisionRecord, MarginCandidate, PlaceMarginOp } from "@/lib/changeset";
import { occurrences } from "@/lib/footnotes";

/** The 1630 edition's scan on Internet Archive (Romae, Typis Vaticanis, 1630). */
const SCAN = "bub_gb_2pQUlbrbtAsC";

/** A scan page in Internet Archive's viewer. */
export function scanPageUrl(page: number): string {
  return `https://archive.org/details/${SCAN}/page/n${page - 1}`;
}

/** A scan page's image, `width` pixels wide. */
export function scanImageUrl(page: number, width = 1000): string {
  return `https://archive.org/download/${SCAN}/page/n${page - 1}_w${width}.jpg`;
}

/** Why an op is listed, in plain words. */
export const CLASS_WORDS: Record<string, string> = {
  "no-mark": "The note's letter isn't printed in the eulogy: it was placed by the words of its lemma.",
  "letter-differs": "The note's letter differs from the mark it was paired with: the eulogy's letter is kept.",
  unanchored: "No phrase of the eulogy could anchor the note: its mark goes at the end.",
  "mark-without-note": "A letter printed in the eulogy, with no note found for it.",
  doubt: "The page-image reviewer was unsure where this margin note stands.",
  "no-image": "Placed without the page image, by where it stands on the page.",
};

/** Where a note's mark goes: after its anchor phrase, or at the end. */
export interface NotePlace {
  id: string;
  /** null: the mark at the end of the eulogy. */
  after: string | null;
  mark: string;
}

/**
 * Why an anchor phrase can't be used in `text`, or null if it can: it must occur exactly once
 * as whole words (as the reader finds it). An empty phrase is no anchor: the mark goes at the end.
 */
export function anchorProblem(text: string, after: string): string | null {
  if (!after) return null;
  const n = occurrences(text, after).length;
  if (n === 1) return null;
  return n === 0 ? "not found as whole words in this eulogy" : `found ${n} times: add a word or two`;
}

/** The decision for placing a note: the proposal unchanged is an accept, anything else an edit. */
export function attachDecision(op: AttachNoteOp, place: NotePlace): DecisionRecord {
  const after = place.after || null;
  if (place.id === op.proposed.id && after === op.proposed.after && place.mark === op.mark) {
    return { decision: "accept" };
  }
  return { decision: "edit", edited: { id: place.id, after, mark: place.mark } };
}

/** Where an attach_note op puts the note: the curator's saved edit, else the proposal. */
export function attachPlace(op: AttachNoteOp, decision?: DecisionRecord): NotePlace {
  const ed = decision?.decision === "edit" ? decision.edited : undefined;
  return {
    id: ed?.id ?? op.proposed.id,
    after: ed && "after" in ed ? (ed.after ?? null) : op.proposed.after,
    mark: ed?.mark ?? op.mark,
  };
}

/** The ref a margin note's proposal names. */
export function proposedRef(op: PlaceMarginOp): string {
  return op.proposed?.note ?? op.proposed?.id ?? "";
}

/** The decision for a margin note beside `c`: the proposal is an accept, another candidate an edit. */
export function marginDecision(op: PlaceMarginOp, c: MarginCandidate): DecisionRecord {
  if (c.ref === proposedRef(op)) return { decision: "accept" };
  return { decision: "edit", edited: c.kind === "note" ? { note: c.ref } : { id: c.ref } };
}

/** The ref a margin note stands beside: the curator's saved edit, else the proposal. */
export function marginRef(op: PlaceMarginOp, decision?: DecisionRecord): string {
  const ed = decision?.decision === "edit" ? decision.edited : undefined;
  return ed?.note ?? ed?.id ?? proposedRef(op);
}
