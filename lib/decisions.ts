import type { Changeset, DecisionRecord } from "@/lib/changeset";
import { opId } from "@/lib/changeset";

export type DecisionMap = Record<string, DecisionRecord>;

export function decisionsKey(cs: Changeset): string {
  return `mrf:decisions:${cs.base.edition}:${cs.base.registry}:${cs.operations.length}`;
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
