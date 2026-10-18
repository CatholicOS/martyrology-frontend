import type { DecisionRecord, Op, PersonCandidate, RenameOp, ResolvePersonOp } from "@/lib/changeset";

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

export type SourceKey = "search" | "companion" | "sparql" | "title" | "curated";

export function sourceKey(source?: string): SourceKey {
  const head = (source ?? "search").split(":")[0];
  return head === "companion" || head === "sparql" || head === "title" || head === "curated" ? head : "search";
}

/** The property a companion candidate was found through ("companion:P3373" gives "P3373"). */
export function companionProp(source?: string): string | null {
  if (!source?.startsWith("companion:")) return null;
  return source.slice("companion:".length) || null;
}

export function opEulogy(op: Op): string | null {
  if (op.op === "rename") return (op as RenameOp).id;
  if (op.op === "resolve_person") return (op as ResolvePersonOp).eulogy;
  return null;
}

/** Ops grouped by eulogy in first-appearance order, the rename first in each group; ops with no eulogy stay single, in place. */
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
    if (op.op === "rename") group.ops.unshift(op);
    else group.ops.push(op);
  }
  return groups;
}
