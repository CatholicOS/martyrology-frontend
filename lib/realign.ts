import type { useTranslations } from "next-intl";
import type { RealignOp, SplitPart } from "@/lib/changeset";

export type ReviewT = ReturnType<typeof useTranslations<"Review">>;

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
export function opLabel(t: ReviewT, op: RealignOp): string {
  const edition = `${op.edition}`;
  switch (op.action) {
    case "rename":
      return t("ops.rename", { id: op.id, newId: op.new_id ?? "" });
    case "rekey":
      return t("ops.rekey", { edition, newId: op.new_id ?? "", target: op.target === "new" ? "new" : "other" });
    case "split":
      return t("ops.split", { edition, count: 1 + (op.parts?.length ?? 0) });
    case "merge":
      return t("ops.merge", { id: op.id, newId: op.new_id ?? "" });
    case "link":
      return t("ops.link", { id: op.id, other: op.same_eulogy_with ?? "" });
    case "rubric":
      return t("ops.rubric", { edition, id: op.id });
    default:
      return t("ops.note", { id: op.id });
  }
}

/** The current (2004) IDs an op points at, whose 2004 text a curator may want to see. */
export function currentTargets(op: RealignOp, isCurrent: (id: string) => boolean): string[] {
  const ids = [op.new_id, op.same_eulogy_with, ...(op.parts ?? []).map((p) => p.id), op.first_id];
  return Array.from(new Set(ids.filter((x): x is string => Boolean(x) && isCurrent(x as string))));
}
