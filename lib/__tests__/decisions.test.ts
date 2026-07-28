import { describe, it, expect, beforeEach } from "vitest";
import { summarize, saveDecisions, loadDecisions, decisionsKey } from "@/lib/decisions";
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
});
