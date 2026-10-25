import type { DecisionRecord, Op, PersonCandidate, RelabelOp, RenameOp, ResolvePersonOp, SubjectLabels } from "@/lib/changeset";

/** What a plain accept on this op applies (a person card's default item, a rename's proposed ID); null for other ops. */
export function resolvedTarget(op: Op): string | null {
  if (op.op === "rename") return (op as RenameOp).new_id;
  if (op.op === "resolve_person") return personDefaultQid(op as ResolvePersonOp) || null;
  return null;
}

/** The rename choice a click records: accept the proposed ID, or edit to another candidate. */
export function renameChoiceRecord(op: RenameOp, newId: string): DecisionRecord {
  if (newId === op.new_id) return { decision: "accept" };
  const candidate = op.candidates?.find((c) => c.new_id === newId);
  if (!candidate) return { decision: "edit", edited: { new_id: newId, subject_la: op.subject_la } };
  return { decision: "edit", edited: { new_id: newId, ...(candidate.labels.la !== null ? { subject_la: candidate.labels.la } : {}) } };
}

/** What taking Jev's rename suggestion records; null when Jev gave none, or chose an ID that is not a candidate. */
export function renameJevRecord(op: RenameOp): DecisionRecord | null {
  const jev = op.jev;
  if (!jev?.decision) return null;
  if (jev.decision === "accept") return { decision: "accept" };
  const id = jev.new_id;
  if (!id || !op.candidates?.some((c) => c.new_id === id)) return null;
  return renameChoiceRecord(op, id);
}

/** The new ID a rename decision gives (crmedr `_new_id`): accept its new_id, edit the edited one; null otherwise. */
export function renameDecidedId(op: RenameOp, d?: DecisionRecord | null): string | null {
  if (d?.decision === "accept") return op.new_id;
  if (d?.decision === "edit") return d.edited?.new_id || op.new_id;
  return null;
}

/** The subject an ID implies, as crmedr `_followed`: id, its labels (null for a typed ID), whether the rename is undecided. */
export interface FollowedSubject {
  id: string | null;
  labels: SubjectLabels | null;
  undecided: boolean;
}

const LANGS = ["la", "en", "it"] as const;

/**
 * The subject the eulogy's decided ID implies (the subject follows the ID, crmedr `_followed`): the
 * relabel candidate whose from_id is that ID, else the rename candidate with that new_id, a null
 * language filled from the current subjects. An undecided rename gives its proposed ID, marked
 * undecided; a rejected rename (or none) gives no ID.
 */
export function followedSubject(op: RelabelOp, rename?: RenameOp | null, decision?: DecisionRecord | null): FollowedSubject {
  if (!rename) return { id: null, labels: null, undecided: false };
  const undecided = !decision;
  const id = undecided ? rename.new_id : renameDecidedId(rename, decision);
  if (id === null) return { id: null, labels: null, undecided: false };
  const own = op.candidates.find((c) => c.from_id === id);
  if (own) return { id, labels: own.labels, undecided };
  const cand = rename.candidates?.find((c) => c.new_id === id);
  if (!cand) return { id, labels: null, undecided };
  const labels = Object.fromEntries(LANGS.map((k) => [k, cand.labels[k] ?? op.current[k] ?? null])) as unknown as SubjectLabels;
  return { id, labels, undecided };
}

/** What a person card's accept means (crmedr `_resolve`). */
export function personDefaultQid(op: ResolvePersonOp): string {
  return op.suggested?.wikidata ?? op.candidates[0]?.wikidata ?? "";
}

/** A listed candidate crmedr's apply accepts (`_appliable`): a title or curated item, or a human with a saint status. */
export function personAppliable(c: PersonCandidate): boolean {
  if (c.source === "title" || c.source === "curated") return true;
  return c.evidence.includes("human") && c.evidence.includes("status");
}

/** What taking Jev's person suggestion records; null when it cannot be applied as written. */
export function personJevRecord(op: ResolvePersonOp): DecisionRecord | null {
  const jev = op.jev;
  if (!jev) return null;
  if (jev.decision === "reject") {
    return jev.reason ? { decision: "reject", edited: { reason: jev.reason } } : null;
  }
  const qid = jev.wikidata;
  const listed = qid ? op.candidates.find((c) => c.wikidata === qid) : undefined;
  if (!qid || !listed || !personAppliable(listed)) return null;
  if (jev.decision === "accept") return qid === personDefaultQid(op) ? { decision: "accept" } : null;
  if (jev.decision === "edit") return { decision: "edit", edited: { wikidata: qid } };
  return null;
}

export type SourceKey = "search" | "companion" | "sparql" | "title" | "curated" | "place";

export function sourceKey(source?: string): SourceKey {
  const head = (source ?? "search").split(":")[0];
  return head === "companion" || head === "sparql" || head === "title" || head === "curated" || head === "place" ? head : "search";
}

/** The property a companion candidate was found through ("companion:P3373" gives "P3373"). */
export function companionProp(source?: string): string | null {
  if (!source?.startsWith("companion:")) return null;
  return source.slice("companion:".length) || null;
}

export function opEulogy(op: Op): string | null {
  if (op.op === "rename") return (op as RenameOp).id;
  if (op.op === "relabel") return (op as RelabelOp).id;
  if (op.op === "resolve_person") return (op as ResolvePersonOp).eulogy;
  return null;
}

// Within a eulogy: the rename, the relabel (its subjects), then the persons, each in file order.
const GROUP_RANK: Record<string, number> = { rename: 0, relabel: 1 };
const groupRank = (op: Op) => GROUP_RANK[op.op] ?? 2;

/** Ops grouped by eulogy in first-appearance order: rename, relabel, then the rest; ops with no eulogy stay single, in place. */
export function groupByEulogy(ops: Op[]): { eulogy: string | null; ops: Op[] }[] {
  const groups: { eulogy: string | null; ops: Op[] }[] = [];
  const byEulogy = new Map<string, { eulogy: string | null; ops: Op[] }>();
  for (const op of ops) {
    const eulogy = opEulogy(op);
    if (eulogy === null) {
      groups.push({ eulogy, ops: [op] });
      continue;
    }
    let group = byEulogy.get(eulogy);
    if (!group) {
      group = { eulogy, ops: [] };
      byEulogy.set(eulogy, group);
      groups.push(group);
    }
    const rank = groupRank(op);
    const at = group.ops.findIndex((o) => groupRank(o) > rank);
    if (at < 0) group.ops.push(op);
    else group.ops.splice(at, 0, op);
  }
  return groups;
}
