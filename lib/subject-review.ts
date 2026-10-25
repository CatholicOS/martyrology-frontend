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

const sameLabels = (a: SubjectLabels, b: SubjectLabels) => a.la === b.la && a.en === b.en && a.it === b.it;

/** Where a relabel record sits among the candidates: the proposal (accept), the current set (reject), or edited labels; -1 when none. */
export function relabelChoiceIndex(op: RelabelOp, d?: DecisionRecord | null): number {
  const target =
    !d || d.decision === "accept" ? op.labels : d.decision === "reject" ? op.current : (d.edited?.labels ?? null);
  if (!target) return -1;
  if (d?.decision === "reject") {
    const current = op.candidates.findIndex((c) => c.from_id === null);
    if (current >= 0) return current;
  }
  return op.candidates.findIndex((c) => sameLabels(c.labels, target));
}

/** The relabel choice a click records: the proposed labels accept, the current set rejects, another candidate edits. */
export function relabelChoiceRecord(op: RelabelOp, index: number): DecisionRecord {
  const c = op.candidates[index];
  if (!c || sameLabels(c.labels, op.labels)) return { decision: "accept" };
  if (c.from_id === null) return { decision: "reject" };
  return { decision: "edit", edited: { labels: c.labels } };
}

/** What taking Jev's relabel pick records; null when Jev gave none, or an edit without labels. */
export function relabelJevRecord(op: RelabelOp): DecisionRecord | null {
  const jev = op.jev;
  if (jev?.decision === "accept") return { decision: "accept" };
  if (jev?.decision === "reject") return { decision: "reject" };
  if (jev?.decision === "edit" && jev.labels) return { decision: "edit", edited: { labels: jev.labels } };
  return null;
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
