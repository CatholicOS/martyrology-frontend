import type { Changeset, DecisionRecord } from "@/lib/changeset";
import { opId } from "@/lib/changeset";

export type DecisionMap = Record<string, DecisionRecord>;

export function decisionsKey(cs: Changeset): string {
  return `mrf:decisions:${cs.base.edition}:${cs.base.registry}:${cs.operations.length}`;
}

/**
 * Decisions carried IN the change-set file itself (e.g. a Claude-Code-prefilled
 * audit). Ops whose `decision` is already set seed the map, so a prefilled
 * change-set shows its decisions on load. Callers overlay localStorage on top so
 * the curator's own in-progress edits take precedence (resume).
 */
export function decisionsFromChangeset(cs: Changeset): DecisionMap {
  const map: DecisionMap = {};
  for (const op of cs.operations) {
    if (op.decision && op.decision !== null) {
      map[opId(op)] = { decision: op.decision, ...(op.edited ? { edited: op.edited } : {}) };
    }
  }
  return map;
}

export function loadDecisions(key: string): DecisionMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}

export function saveDecisions(key: string, map: DecisionMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(map));
}

export function summarize(
  cs: Changeset,
  map: DecisionMap
): { accepted: number; rejected: number; edited: number; undecided: number } {
  let accepted = 0,
    rejected = 0,
    edited = 0,
    undecided = 0;
  for (const op of cs.operations) {
    const d = map[opId(op)]?.decision;
    if (d === "accept") accepted++;
    else if (d === "reject") rejected++;
    else if (d === "edit") edited++;
    else undecided++;
  }
  return { accepted, rejected, edited, undecided };
}
