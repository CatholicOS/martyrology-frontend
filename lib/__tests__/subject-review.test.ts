import { describe, it, expect } from "vitest";
import { opId, type Op, type RelabelOp, type RenameOp, type ResolvePersonOp, type PersonCandidate } from "@/lib/changeset";
import {
  companionProp, groupByEulogy, personAppliable, personDefaultQid, personJevRecord,
  followedSubject, relabelConflicts, renameChoiceRecord, renameDecidedId, renameJevRecord, resolvedTarget, sourceKey,
} from "@/lib/subject-review";

const rename = (id: string, newId: string): RenameOp => ({
  op: "rename", id, new_id: newId, uid: `subject:${id}`, subject_la: "Sanctus Eugendus", decision: null,
});

const OP: RenameOp = {
  ...rename("mr:0101-eugendus", "mr:0101-eugendus-abbas-condatiscensis"),
  candidates: [
    { new_id: "mr:0101-eugendus-abbas-condatiscensis", category: "role-place", weak: false,
      labels: { la: "Sanctus Eugendus abbas Condatiscensis", en: null, it: null }, basis: "role and place" },
    { new_id: "mr:0101-eugendus-condatiscensis", category: "place-adjective", weak: false,
      labels: { la: "Sanctus Eugendus Condatiscensis", en: null, it: null }, basis: "place" },
    { new_id: "mr:0101-eugendus-condatisci", category: "place-genitive", weak: true,
      labels: { la: "Sanctus Eugendus Condatisci", en: null, it: null }, basis: "bare-name draft" },
  ],
};

const cand = (wikidata: string, evidence: string[], source?: string): PersonCandidate => ({
  wikidata, label: wikidata, description: "", names: [], human: true, statuses: [], born: null, died: null,
  feast: [], evidence, ...(source ? { source } : {}),
});

const person = (eulogy: string, id: string): ResolvePersonOp => ({
  op: "resolve_person", id, eulogy, day: "01-01", typology: null, subject: "S", name: "A", where: "text",
  companions: [], failed: [], decision: null,
  candidates: [cand("Q1", ["human", "status"], "search"), cand("Q2", ["human", "status"], "companion:P3373"), cand("Q3", [], "title")],
});
const POP = person("mr:0101-a", "mr:0101-a|A");

const CURRENT = { la: "Sanctus A", en: "Saint A", it: "Sant'A" };
const PROPOSED = { la: "Sanctus A Romanus", en: "Saint A of Rome", it: "Sant'A di Roma" };
const OTHER = { la: "Sanctus A Ostiensis", en: "Saint A of Ostia", it: "Sant'A di Ostia" };
const relabel = (id: string): RelabelOp => ({
  op: "relabel", id, uid: `labels:${id}`, current: CURRENT, labels: PROPOSED, decision: null,
  candidates: [{ labels: PROPOSED, from_id: `${id}-romae` }, { labels: OTHER, from_id: `${id}-ostiae` }, { labels: CURRENT, from_id: null }],
});

describe("subject review", () => {
  it("a rename choice accepts the proposed ID or edits to another candidate", () => {
    expect(renameChoiceRecord(OP, OP.new_id)).toEqual({ decision: "accept" });
    expect(renameChoiceRecord(OP, "mr:0101-eugendus-condatiscensis")).toEqual(
      { decision: "edit", edited: { new_id: "mr:0101-eugendus-condatiscensis", subject_la: "Sanctus Eugendus Condatiscensis" } });
    expect(renameChoiceRecord(OP, "mr:0101-other")).toEqual(
      { decision: "edit", edited: { new_id: "mr:0101-other", subject_la: "Sanctus Eugendus" } });
  });

  it("a candidate with no Latin label records no subject_la", () => {
    const nol = { ...OP, candidates: [...OP.candidates!, { new_id: "mr:0101-nol", category: "role" as const, weak: false, labels: { la: null, en: null, it: null }, basis: "x" }] };
    expect(renameChoiceRecord(nol, "mr:0101-nol")).toEqual({ decision: "edit", edited: { new_id: "mr:0101-nol" } });
  });

  it("resolvedTarget is what a plain accept applies", () => {
    expect(resolvedTarget(OP)).toBe(OP.new_id);
    expect(resolvedTarget(POP)).toBe("Q1");
    expect(resolvedTarget({ ...POP, suggested: { wikidata: "Q2" } })).toBe("Q2");
    expect(resolvedTarget({ op: "delete", id: "x", decision: null } as never)).toBeNull();
  });

  it("Jev's rename suggestion records only a candidate", () => {
    const base = { probability: 0.9, confidence: 0.9, model: "jev", flags: [], scores: {} };
    expect(renameJevRecord(OP)).toBeNull();
    expect(renameJevRecord({ ...OP, jev: { decision: "accept", ...base } })).toEqual({ decision: "accept" });
    expect(renameJevRecord({ ...OP, jev: { decision: "edit", new_id: "mr:0101-eugendus-condatiscensis", ...base } }))
      .toEqual({ decision: "edit", edited: { new_id: "mr:0101-eugendus-condatiscensis", subject_la: "Sanctus Eugendus Condatiscensis" } });
    expect(renameJevRecord({ ...OP, jev: { decision: "edit", new_id: "mr:0101-x", ...base } })).toBeNull();
    expect(renameJevRecord({ ...OP, jev: { flags: ["record:places[0]"], model: "jev", scores: {} } })).toBeNull();
  });

  it("Jev's person suggestion records only what apply accepts", () => {
    const base = { probability: 0.9, confidence: 0.9, model: "jev" };
    expect(personDefaultQid(POP)).toBe("Q1");
    expect(personDefaultQid({ ...POP, suggested: { wikidata: "Q2" } })).toBe("Q2");
    expect(personJevRecord(POP)).toBeNull();
    expect(personJevRecord({ ...POP, jev: { decision: "accept", wikidata: "Q1", ...base } })).toEqual({ decision: "accept" });
    expect(personJevRecord({ ...POP, jev: { decision: "accept", wikidata: "Q2", ...base } })).toBeNull();
    expect(personJevRecord({ ...POP, jev: { decision: "edit", wikidata: "Q2", source: "companion:P3373", ...base } }))
      .toEqual({ decision: "edit", edited: { wikidata: "Q2" } });
    expect(personJevRecord({ ...POP, jev: { decision: "edit", wikidata: "Q3", ...base } }))
      .toEqual({ decision: "edit", edited: { wikidata: "Q3" } });
    expect(personJevRecord({ ...POP, jev: { decision: "edit", wikidata: "Q9", ...base } })).toBeNull();
    expect(personJevRecord({ ...POP, jev: { decision: "reject", reason: "Jev: none of the candidates is this person", ...base } }))
      .toEqual({ decision: "reject", edited: { reason: "Jev: none of the candidates is this person" } });
    expect(personJevRecord({ ...POP, jev: { decision: "reject", reason: "", ...base } })).toBeNull();
  });

  it("a candidate is appliable by source or by evidence", () => {
    expect(personAppliable(POP.candidates[0])).toBe(true);
    expect(personAppliable(POP.candidates[2])).toBe(true);
    expect(personAppliable(cand("Q4", ["curated-x"], "curated"))).toBe(true);
    expect(personAppliable(cand("Q5", ["human"], "search"))).toBe(false);
  });

  it("reads a candidate's source", () => {
    expect(sourceKey(undefined)).toBe("search");
    expect(sourceKey("companion:P3373")).toBe("companion");
    expect(sourceKey("sparql")).toBe("sparql");
    expect(sourceKey("title")).toBe("title");
    expect(sourceKey("curated")).toBe("curated");
    expect(companionProp("companion:P3373")).toBe("P3373");
    expect(companionProp("search")).toBeNull();
    expect(companionProp(undefined)).toBeNull();
  });

  it("groups rename, relabel, persons", () => {
    const ops: Op[] = [person("mr:0101-a", "mr:0101-a|A"), relabel("mr:0101-a"), rename("mr:0101-a", "mr:0101-aa"), relabel("mr:0102-b")];
    const groups = groupByEulogy(ops);
    expect(groups.map((g) => g.ops.map(opId))).toEqual([
      ["subject:mr:0101-a", "labels:mr:0101-a", "mr:0101-a|A"], ["labels:mr:0102-b"],
    ]);
    expect(groups.map((g) => g.eulogy)).toEqual(["mr:0101-a", "mr:0102-b"]);
  });

  it("renders a eulogy with no relabel op", () => {
    const groups = groupByEulogy([person("mr:0101-a", "mr:0101-a|A"), rename("mr:0101-a", "mr:0101-aa")]);
    expect(groups.map((g) => g.ops.map(opId))).toEqual([["subject:mr:0101-a", "mr:0101-a|A"]]);
  });

  it("the decided ID of a rename: accept its new_id, edit the edited one, else none (crmedr _new_id)", () => {
    const op = rename("mr:0101-a", "mr:0101-a-romae");
    expect(renameDecidedId(op, { decision: "accept" })).toBe("mr:0101-a-romae");
    expect(renameDecidedId(op, { decision: "edit", edited: { new_id: "mr:0101-a-ostiae" } })).toBe("mr:0101-a-ostiae");
    expect(renameDecidedId(op, { decision: "edit", edited: {} })).toBe("mr:0101-a-romae");
    expect(renameDecidedId(op, { decision: "reject" })).toBeNull();
    expect(renameDecidedId(op, undefined)).toBeNull();
  });

  describe("the subject follows the ID (crmedr _followed)", () => {
    const op = relabel("mr:0101-a");
    // The rename's third candidate was deduplicated out of the relabel: its labels, None filled from current.
    const ren: RenameOp = {
      ...rename("mr:0101-a", "mr:0101-a-romae"),
      candidates: [
        { new_id: "mr:0101-a-romae", category: "place-genitive", weak: false, labels: PROPOSED, basis: "b" },
        { new_id: "mr:0101-a-ostiae", category: "place-genitive", weak: false, labels: OTHER, basis: "b" },
        { new_id: "mr:0101-a-presbyter", category: "role", weak: false, labels: { la: "Sanctus A presbyter", en: null, it: null }, basis: "b" },
      ],
    };

    it("accept follows the proposed ID's relabel candidate", () => {
      expect(followedSubject(op, ren, { decision: "accept" })).toEqual({ id: "mr:0101-a-romae", labels: PROPOSED, undecided: false });
    });

    it("an edit to another candidate follows that candidate", () => {
      expect(followedSubject(op, ren, { decision: "edit", edited: { new_id: "mr:0101-a-ostiae" } }))
        .toEqual({ id: "mr:0101-a-ostiae", labels: OTHER, undecided: false });
    });

    it("a rename candidate deduplicated out of the relabel: its own labels, None filled from current", () => {
      expect(followedSubject(op, ren, { decision: "edit", edited: { new_id: "mr:0101-a-presbyter" } }))
        .toEqual({ id: "mr:0101-a-presbyter", labels: { la: "Sanctus A presbyter", en: "Saint A", it: "Sant'A" }, undecided: false });
    });

    it("a typed ID implies no subject", () => {
      expect(followedSubject(op, ren, { decision: "edit", edited: { new_id: "mr:0101-a-typed" } }))
        .toEqual({ id: "mr:0101-a-typed", labels: null, undecided: false });
    });

    it("an undecided rename: the subject of its proposed ID, marked undecided", () => {
      expect(followedSubject(op, ren, undefined)).toEqual({ id: "mr:0101-a-romae", labels: PROPOSED, undecided: true });
    });

    it("a rejected rename, or none, gives no ID", () => {
      expect(followedSubject(op, ren, { decision: "reject" })).toEqual({ id: null, labels: null, undecided: false });
      expect(followedSubject(op, undefined, undefined)).toEqual({ id: null, labels: null, undecided: false });
    });
  });

  it("relabel conflicts: an accepted relabel whose ID gives no subject to follow (crmedr relabel_errors)", () => {
    const ren = { ...rename("mr:0101-a", "mr:0101-a-romae"), candidates: [] };
    const rel = relabel("mr:0101-a");
    const ops: Op[] = [ren, rel];
    const acc = { decision: "accept" as const };
    expect(relabelConflicts(ops, { "subject:mr:0101-a": acc, "labels:mr:0101-a": acc })).toEqual([]);
    expect(relabelConflicts(ops, { "labels:mr:0101-a": acc })).toEqual(["mr:0101-a"]);
    expect(relabelConflicts(ops, { "subject:mr:0101-a": { decision: "reject" }, "labels:mr:0101-a": acc })).toEqual(["mr:0101-a"]);
    expect(relabelConflicts(ops, { "subject:mr:0101-a": { decision: "edit", edited: { new_id: "mr:0101-a-typed" } }, "labels:mr:0101-a": acc }))
      .toEqual(["mr:0101-a"]);
    expect(relabelConflicts([rel], { "labels:mr:0101-a": acc })).toEqual(["mr:0101-a"]);
    // Edit and keep never conflict; neither does an undecided relabel.
    expect(relabelConflicts(ops, { "labels:mr:0101-a": { decision: "reject" } })).toEqual([]);
    expect(relabelConflicts(ops, { "labels:mr:0101-a": { decision: "edit", edited: { labels: OTHER } } })).toEqual([]);
    expect(relabelConflicts(ops, {})).toEqual([]);
  });

  it("groups a eulogy's ops with the rename first", () => {
    const other: Op = { op: "delete", id: "mr:0103-c", decision: null };
    const ops: Op[] = [person("mr:0101-a", "mr:0101-a|A"), other, rename("mr:0102-b", "mr:0102-bb"), rename("mr:0101-a", "mr:0101-aa"), person("mr:0102-b", "mr:0102-b|B#2")];
    const groups = groupByEulogy(ops);
    expect(groups.map((g) => g.ops.map(opId))).toEqual([
      ["subject:mr:0101-a", "mr:0101-a|A"], ["mr:0103-c"], ["subject:mr:0102-b", "mr:0102-b|B#2"],
    ]);
    expect(groups.map((g) => g.eulogy)).toEqual(["mr:0101-a", null, "mr:0102-b"]);
  });
});
