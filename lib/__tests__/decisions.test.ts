import { describe, it, expect, beforeEach } from "vitest";
import { summarize, saveDecisions, loadDecisions, loadDecisionsFor, decisionsKey, decisionsFromChangeset } from "@/lib/decisions";
import type { Changeset } from "@/lib/changeset";

const cs: Changeset = { schema: "crmedr-changeset/v1", generated_by: "x", base: { edition: "e", registry: "r" },
  operations: [ { op: "rename", id: "a", new_id: "a2", decision: null }, { op: "delete", id: "b", decision: null }, { op: "merge", ids: ["c"], winner: "c2", decision: null } ] as never };

describe("decisions", () => {
  beforeEach(() => localStorage.clear());
  it("summarizes decided vs undecided", () => {
    const s = summarize(cs, { a: { decision: "accept" }, b: { decision: "reject" } });
    expect(s).toEqual({ accepted: 1, rejected: 1, edited: 0, undecided: 1 });
  });
  it("persists and reloads by key", () => {
    const key = decisionsKey(cs);
    saveDecisions(key, { a: { decision: "edit", edited: { new_id: "z" } } });
    expect(loadDecisions(key)).toEqual({ a: { decision: "edit", edited: { new_id: "z" } } });
  });
  it("keeps the decisions of an earlier version for the cards still there", () => {
    const earlier: Changeset = { ...cs, base: { edition: "e", registry: "r0" },
      operations: [ ...cs.operations, { op: "delete", id: "gone", decision: null } ] as never };
    saveDecisions(decisionsKey(earlier), { a: { decision: "accept" }, b: { decision: "reject" }, gone: { decision: "accept" } });
    saveDecisions(decisionsKey(cs), { b: { decision: "accept" } });
    saveDecisions(decisionsKey({ ...cs, base: { edition: "other", registry: "r" } }), { c: { decision: "reject" } });
    // this key's own decisions win; a card no longer in the set and another edition's are left out
    expect(loadDecisionsFor(cs)).toEqual({ a: { decision: "accept" }, b: { decision: "accept" } });
  });
  describe("a carried accept's target", () => {
    const person = (suggested?: string) => ({ op: "resolve_person", id: "p|A", eulogy: "p", decision: null,
      candidates: [{ wikidata: "Q1" }, { wikidata: "Q2" }], ...(suggested ? { suggested: { wikidata: suggested } } : {}) });
    const csOf = (registry: string, op: unknown): Changeset => ({ ...cs, base: { edition: "e", registry }, operations: [op] as never });
    const earlier = csOf("r0", person());
    it("is kept when it matches, dropped when the default moved, kept when legacy", () => {
      saveDecisions(decisionsKey(earlier), { "p|A": { decision: "accept", target: "Q1" } });
      expect(loadDecisionsFor(csOf("r1", person()))).toEqual({ "p|A": { decision: "accept", target: "Q1" } });
      expect(loadDecisionsFor(csOf("r1", person("Q2")))).toEqual({});
      saveDecisions(decisionsKey(earlier), { "p|A": { decision: "accept" } });
      expect(loadDecisionsFor(csOf("r1", person("Q2")))).toEqual({ "p|A": { decision: "accept" } });
    });
    it("drops a same-key accept whose target changed, keeps one that still matches", () => {
      const now = csOf("r1", person("Q2"));
      saveDecisions(decisionsKey(now), { "p|A": { decision: "accept", target: "Q1" } });
      expect(loadDecisionsFor(now)).toEqual({});
      saveDecisions(decisionsKey(now), { "p|A": { decision: "accept", target: "Q2" } });
      expect(loadDecisionsFor(now)).toEqual({ "p|A": { decision: "accept", target: "Q2" } });
    });
  });
  it("seeds decisions carried in the change-set file", () => {
    const prefilled: Changeset = { schema: "crmedr-changeset/v1", generated_by: "claude-code", base: { edition: "e", registry: "r" },
      operations: [ { op: "merge", ids: ["c"], winner: "c2", decision: "reject" }, { op: "merge", ids: ["d"], winner: "d2", decision: "accept" }, { op: "rename", id: "a", new_id: "a2", decision: null } ] as never };
    expect(decisionsFromChangeset(prefilled)).toEqual({ c: { decision: "reject" }, d: { decision: "accept" } });
  });
});
