import type { Changeset, DecisionRecord } from "@/lib/changeset";
import { opId } from "@/lib/changeset";
import { resolvedTarget } from "@/lib/subject-review";

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

/**
 * The decisions saved for this change-set: those under its own key, over those
 * saved for an earlier version of it (same edition: a regenerated change-set can
 * change its op count or base, and so its key), matched by op id, so that the
 * cards it still has keep their decisions.
 */
export function loadDecisionsFor(cs: Changeset): DecisionMap {
  if (typeof window === "undefined") return {};
  const key = decisionsKey(cs);
  const prefix = `mrf:decisions:${cs.base.edition}:`;
  const ops = new Map(cs.operations.map((op) => [opId(op), op]));
  const carried: DecisionMap = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || k === key || !k.startsWith(prefix)) continue;
      for (const [id, d] of Object.entries(loadDecisions(k))) {
        const op = ops.get(id);
        if (!op) continue;
        // An accept carried from another version keeps its meaning only if it still resolves to the same target.
        if (d.target !== undefined && d.target !== resolvedTarget(op)) continue;
        carried[id] = d;
      }
    }
  } catch {
    // storage unavailable: only this key's decisions
  }
  return { ...carried, ...loadDecisions(key) };
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
