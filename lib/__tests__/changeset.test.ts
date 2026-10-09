import { describe, it, expect } from "vitest";
import { parseChangeset, exportChangeset, opId, isAdjudicable } from "@/lib/changeset";
import { convertManifest, splitByMonth, toBundledChangeset } from "@/scripts/import-changeset.mjs";

const manifest = [
  { old_id: "mr:0104-titi", new_id: "mr:0104-titus", action: "rename", new_subject_la: "Sanctus Titus", class: "A-genitive", confidence: "high", incipit: "In Creta natalis sancti Titi", reasoning: "person" },
  { old_id: "mr:1225-quodsequitur-legitur-in", new_id: "", action: "delete", class: "G-rubric", confidence: "high", incipit: "Quod sequitur" },
  { old_id: "mr:0108-severinus-neapoli", new_id: "mr:0108-severinus", action: "delete", class: "M-merge", confidence: "low", incipit: "Neapoli, in Campania" },
];

describe("changeset", () => {
  it("converts a CRMEDR manifest to crmedr-changeset/v1", () => {
    const cs = convertManifest(manifest, { edition: "martyrologium_romanum_1749", registry: "crmedr@test" });
    expect(cs.schema).toBe("crmedr-changeset/v1");
    expect(cs.operations[0]).toMatchObject({ op: "rename", id: "mr:0104-titi", new_id: "mr:0104-titus", subject_la: "Sanctus Titus", decision: null });
    expect(cs.operations[1]).toMatchObject({ op: "delete", id: "mr:1225-quodsequitur-legitur-in", reason: "rubric" });
    expect(cs.operations[2]).toMatchObject({ op: "merge", ids: ["mr:0108-severinus-neapoli"], winner: "mr:0108-severinus" });
  });

  it("parseChangeset rejects wrong schema", () => {
    expect(() => parseChangeset(JSON.stringify({ schema: "nope", operations: [] }))).toThrow();
  });

  it("exportChangeset merges decisions and edits", () => {
    const cs = convertManifest(manifest, { edition: "e", registry: "r" });
    const out = exportChangeset(cs, { [opId(cs.operations[0])]: { decision: "edit", edited: { new_id: "mr:0104-titus-x" } }, [opId(cs.operations[1])]: { decision: "accept" } });
    expect(out.generated_by).toBe("curation-ui");
    expect(out.operations[0]).toMatchObject({ decision: "edit", edited: { new_id: "mr:0104-titus-x" } });
    expect(out.operations[1].decision).toBe("accept");
    expect(out.operations[2].decision).toBeNull();
  });

  it("resolve_place ops are adjudicable and keyed by their place", () => {
    const op = { op: "resolve_place", id: "Fictópoli", la: "Fictópoli", decision: null };
    expect(isAdjudicable(op)).toBe(true);
    expect(opId(op)).toBe("Fictópoli");
  });

  it("exportChangeset carries a place edit", () => {
    const cs = parseChangeset(JSON.stringify({ schema: "crmedr-changeset/v1", generated_by: "x", base: { edition: "2004", registry: "data/places.json" },
      operations: [{ op: "resolve_place", id: "Fictópoli", la: "Fictópoli", decision: null, edited: null }] }));
    const edited = { wikidata: "Q2", country: "FR" };
    const out = exportChangeset(cs, { "Fictópoli": { decision: "edit", edited } });
    expect(out.operations[0]).toMatchObject({ decision: "edit", edited });
  });

  it("toBundledChangeset passes a change-set through and converts a manifest", () => {
    const cs = { schema: "crmedr-changeset/v1", generated_by: "scripts/build_gazetteer.py", base: { edition: "2004", registry: "data/places.json" }, operations: [] };
    expect(toBundledChangeset(cs, { edition: "e", registry: "r" })).toBe(cs);
    expect(toBundledChangeset(manifest, { edition: "e", registry: "r" }).operations[0]).toMatchObject({ op: "rename" });
  });
});

describe("splitByMonth", () => {
  const op = (id: string, eulogy: string, day: string) => ({ op: "resolve_person", id, eulogy, day, decision: null, edited: null });
  const cs = {
    schema: "crmedr-changeset/v1" as const, generated_by: "scripts/build_person_items.py", generated_at: "2026-10-09",
    base: { edition: "martyrologium_romanum_2004", registry: "data/persons.json" },
    operations: [op("mr:0206-a|A", "mr:0206-a", "02-06"), op("mr:1224-b|B", "mr:1224-b", "12-24"), op("mr:0201-c|C", "mr:0201-c", "02-01")],
  };

  it("makes one change-set per month that has operations, named by the month, each complete", () => {
    const parts = splitByMonth(cs, "persons-review");
    expect(parts.map((p) => p.name)).toEqual(["persons-review-02", "persons-review-12"]);
    expect(parts[0].changeset.operations.map(opId)).toEqual(["mr:0206-a|A", "mr:0201-c|C"]);
    expect(parts[0].changeset).toMatchObject({ schema: "crmedr-changeset/v1", base: cs.base, generated_at: "2026-10-09" });
  });

  it("takes the month from the eulogy ID when an operation has no day", () => {
    const parts = splitByMonth({ ...cs, operations: [{ op: "x", id: "mr:0315-d", decision: null, edited: null }] }, "q");
    expect(parts.map((p) => p.name)).toEqual(["q-03"]);
  });
});
