import type { RealignOp, SplitPart } from "@/lib/changeset";

export interface Segment {
  id: string;
  text: string;
}

/**
 * Cut a run-in key's text into the eulogies it holds: the text before the first
 * split point takes `firstId`, and each part runs from its `split_at` to the next
 * part's. Parts are placed by where their `split_at` occurs, whatever their order.
 * A `split_at` that does not occur in the text is returned in `missing`.
 */
export function splitText(
  text: string,
  firstId: string,
  parts: SplitPart[]
): { segments: Segment[]; missing: SplitPart[] } {
  const found: { at: number; part: SplitPart }[] = [];
  const missing: SplitPart[] = [];
  for (const part of parts) {
    const at = part.split_at ? text.indexOf(part.split_at) : -1;
    if (at < 0) missing.push(part);
    else found.push({ at, part });
  }
  found.sort((a, b) => a.at - b.at);
  const segments: Segment[] = [];
  const head = text.slice(0, found.length ? found[0].at : text.length).trim();
  if (head) segments.push({ id: firstId, text: head });
  found.forEach(({ at, part }, i) => {
    const end = i + 1 < found.length ? found[i + 1].at : text.length;
    segments.push({ id: part.id, text: text.slice(at, end).trim() });
  });
  return { segments, missing };
}

/** A one-line statement of what the op proposes. */
export function describeRealign(op: RealignOp): string {
  const ed = `${op.edition}`;
  switch (op.action) {
    case "rename":
      return `Rename ${op.id} → ${op.new_id} (every edition)`;
    case "rekey":
      return `${ed}: key this text as ${op.new_id}${op.target === "new" ? " (new deprecated ID)" : ""}`;
    case "split":
      return `${ed}: split into ${1 + (op.parts?.length ?? 0)} eulogies`;
    case "merge":
      return `Merge ${op.id} into ${op.new_id} (same day, same eulogy)`;
    case "link":
      return `Link ${op.id} ⇄ ${op.same_eulogy_with} (same_eulogy)`;
    case "rubric":
      return `${ed}: ${op.id} is a rubric, not a eulogy`;
    default:
      return `Note on ${op.id}`;
  }
}

/** The current (2004) IDs an op points at, whose 2004 text a curator may want to see. */
export function currentTargets(op: RealignOp, isCurrent: (id: string) => boolean): string[] {
  const ids = [op.new_id, op.same_eulogy_with, ...(op.parts ?? []).map((p) => p.id), op.first_id];
  return Array.from(new Set(ids.filter((x): x is string => Boolean(x) && isCurrent(x as string))));
}
