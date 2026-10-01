import { describe, it, expect } from "vitest";
import { parseChangeset, exportChangeset, opId, isAdjudicable } from "@/lib/changeset";
import { convertManifest, toBundledChangeset } from "@/scripts/import-changeset.mjs";

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

  it("exportChangeset carries a place edit with text_says", () => {
    const cs = parseChangeset(JSON.stringify({ schema: "crmedr-changeset/v1", generated_by: "x", base: { edition: "2004", registry: "data/places.json" },
      operations: [{ op: "resolve_place", id: "Fictópoli", la: "Fictópoli", decision: null, edited: null }] }));
    const edited = { wikidata: "Q2", country: "FR", text_says: [{ country: "DE", it: "A Fictopoli, ora in Germania" }] };
    const out = exportChangeset(cs, { "Fictópoli": { decision: "edit", edited } });
    expect(out.operations[0]).toMatchObject({ decision: "edit", edited });
  });

  it("toBundledChangeset passes a change-set through and converts a manifest", () => {
    const cs = { schema: "crmedr-changeset/v1", generated_by: "scripts/build_gazetteer.py", base: { edition: "2004", registry: "data/places.json" }, operations: [] };
    expect(toBundledChangeset(cs, { edition: "e", registry: "r" })).toBe(cs);
    expect(toBundledChangeset(manifest, { edition: "e", registry: "r" }).operations[0]).toMatchObject({ op: "rename" });
  });
});
