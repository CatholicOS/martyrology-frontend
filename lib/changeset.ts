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
  // resolve_place
  wikidata?: string;
  country?: string;
  text_says?: TextSays[];
}

export interface DecisionRecord {
  decision: Exclude<Decision, null>;
  edited?: EditedFields;
}

interface Base {
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
  suggested?: { wikidata: string; country: string; text_says?: TextSays[] } | null;
}

export interface UnknownOp extends Base {
  op: string;
  id?: string;
  [k: string]: unknown;
}

export type Op = RenameOp | DeleteOp | MergeOp | ResolvePlaceOp | UnknownOp;

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
  return op.op === "rename" || op.op === "delete" || op.op === "merge" || op.op === "resolve_place";
}

export function opId(op: Op): string {
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
