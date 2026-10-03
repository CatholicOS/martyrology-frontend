export type Decision = null | "accept" | "reject" | "edit";

export interface TextSays {
  country: string;
  it: string;
}

export interface EditedFields {
  new_id?: string;
  subject_la?: string;
  winner?: string;
  reason?: string;
  // resolve_place (text_says is derived by crmedr's apply, never chosen)
  wikidata?: string;
  country?: string;
  // realign
  action?: RealignAction;
  /** An empty string removes the proposed link. */
  same_eulogy_with?: string;
  parts?: SplitPart[];
  first_id?: string;
  note?: string;
}

export interface DecisionRecord {
  decision: Exclude<Decision, null>;
  edited?: EditedFields;
}

interface Base {
  /** An explicit unique key, for change-sets that hold several ops on one id. */
  uid?: string;
  class?: string;
  confidence?: string;
  incipit?: string;
  reasoning?: string;
  decision: Decision;
  edited?: EditedFields | null;
}

export interface RenameOp extends Base {
  op: "rename";
  id: string;
  new_id: string;
  subject_la?: string;
}

export interface DeleteOp extends Base {
  op: "delete";
  id: string;
  reason?: string;
}

export interface MergeOp extends Base {
  op: "merge";
  ids: string[];
  winner: string;
}

/** A Wikidata candidate for a place, as written by crmedr's scripts/build_gazetteer.py. */
export interface PlaceCandidate {
  wikidata: string;
  label: string;
  description: string;
  /** The single current country (ISO 3166-1 alpha-2), or null. */
  country: string | null;
  countries: string[];
  la: string[];
  p9314: boolean;
  coords: [number, number] | null;
  types: string[];
  evidence: string[];
}

/** Resolve a printed Latin place designation to a Wikidata item (crmedr gazetteer). */
export interface ResolvePlaceOp extends Base {
  op: "resolve_place";
  /** The Latin place designation as printed; also the op's key. */
  id: string;
  la: string;
  it: string[];
  occurrences: string[];
  claims: TextSays[];
  failed: string[];
  candidates: PlaceCandidate[];
  suggested?: { wikidata: string; country: string } | null;
}

export type RealignAction = "rename" | "rekey" | "split" | "merge" | "link" | "note" | "rubric";

/** One eulogy a run-in key's text is split into, from `split_at` up to the next part. */
export interface SplitPart {
  split_at: string;
  id: string;
  /** Whether `id` is a current or deprecated registry ID, or a new one to coin. */
  target?: "current" | "deprecated" | "new";
  subject_la?: string;
}

/**
 * How one historical edition keys one eulogy (crmedr #51): re-mint a garbled slug
 * (rename, every edition), move the edition's text to another ID (rekey), split a
 * key holding several eulogies (split), merge into a same-day ID, link a eulogy to
 * its counterpart on another day (link, `same_eulogy`), record a curator note, or
 * turn a key that is a rubric into the day's `rubricae` (rubric). The texts are the
 * public-domain historical ones the op is about, carried in the change-set.
 */
export interface RealignOp extends Base {
  op: "realign";
  id: string;
  /** The historical edition the finding was read in ("1749", "1914"). */
  edition: string;
  action: RealignAction;
  new_id?: string;
  target?: "current" | "deprecated" | "new";
  subject_la?: string;
  same_eulogy_with?: string;
  parts?: SplitPart[];
  /** The ID the text before the first split point takes. */
  first_id?: string;
  explanation?: string;
  evidence?: string;
  /** id → edition → text. */
  texts?: Record<string, Record<string, string>>;
}

export interface UnknownOp extends Base {
  op: string;
  id?: string;
  [k: string]: unknown;
}

export type Op = RenameOp | DeleteOp | MergeOp | ResolvePlaceOp | RealignOp | UnknownOp;

export interface Changeset {
  schema: "crmedr-changeset/v1";
  generated_by: string;
  generated_at?: string;
  base: { edition: string; registry: string };
  operations: Op[];
}

export function parseChangeset(text: string): Changeset {
  const cs = JSON.parse(text);
  if (cs?.schema !== "crmedr-changeset/v1") {
    throw new Error(`Unsupported change-set schema: ${cs?.schema}`);
  }
  if (!Array.isArray(cs.operations)) {
    throw new Error("change-set has no operations[]");
  }
  return cs as Changeset;
}

export function isAdjudicable(op: Op): boolean {
  return (
    op.op === "rename" ||
    op.op === "delete" ||
    op.op === "merge" ||
    op.op === "resolve_place" ||
    op.op === "realign"
  );
}

export function opId(op: Op): string {
  if (typeof op.uid === "string" && op.uid !== "") return op.uid;
  if (op.op === "merge") return (op as MergeOp).ids.join("+");
  return (op as { id?: string }).id ?? JSON.stringify(op);
}

export function exportChangeset(
  cs: Changeset,
  decisions: Record<string, DecisionRecord>
): Changeset {
  return {
    ...cs,
    generated_by: "curation-ui",
    operations: cs.operations.map((op) => {
      const d = decisions[opId(op)];
      return d
        ? { ...op, decision: d.decision, edited: d.edited ?? null }
        : { ...op, decision: op.decision ?? null };
    }),
  };
}
