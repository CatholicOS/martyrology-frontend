import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseChangeset, exportChangeset, opId, isAdjudicable, isMentionOp, type MentionOp } from "@/lib/changeset";
import { convertManifest, main, quotesText, splitByMonth, toBundledChangeset, writeBundle } from "@/scripts/import-changeset.mjs";

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

describe("mention operations", () => {
  const base = {
    edition: "martyrologium_romanum_2004", eulogy: "mr:0101-fictinus", where: "text" as const,
    context: "Fictópoli in Utópia, natális sancti Fictíni et Ficti, epíscopi.", context_start: 120,
    reasoning: "", decision: null, edited: null,
  };
  const add: MentionOp = { ...base, op: "add_mention", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|156",
    kind: "person", name: "Fictinus", start: 156, end: 163, form: "Fictíni" };
  const set: MentionOp = { ...base, op: "set_span", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|156",
    kind: "person", name: "Fictinus", from: { start: 156, end: 163 }, to: { start: 156, end: 172, form: "Fictíni et Ficti" } };
  const remove: MentionOp = { ...base, op: "remove_mention", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|120",
    kind: "place", start: 120, end: 129, form: "Fictópoli" };

  it("are adjudicable, recognised as mentions, and keyed by their id", () => {
    for (const op of [add, set, remove]) {
      expect(isAdjudicable(op)).toBe(true);
      expect(isMentionOp(op)).toBe(true);
      expect(opId(op)).toBe(op.id);
    }
    expect(isMentionOp({ op: "resolve_place", id: "x", decision: null })).toBe(false);
  });

  it("export a chosen span on the op", () => {
    const cs = parseChangeset(JSON.stringify({ schema: "crmedr-changeset/v1", generated_by: "scripts/extract_mentions.py",
      base: { edition: "martyrologium_romanum_2004", registry: "data/mentions.json" }, operations: [add, remove] }));
    const edited = { start: 156, end: 172, form: "Fictíni et Ficti" };
    const out = exportChangeset(cs, { [add.id]: { decision: "edit", edited }, [remove.id]: { decision: "reject" } });
    expect(out.operations[0]).toMatchObject({ op: "add_mention", decision: "edit", edited });
    expect(out.operations[1]).toMatchObject({ op: "remove_mention", decision: "reject", edited: null });
  });
});

describe("bundling the mentions review", () => {
  const op = (id: string, eulogy: string, extra = {}) => ({ op: "add_mention", id, eulogy, edition: "martyrologium_romanum_2004", where: "text",
    kind: "person", start: 0, end: 7, form: "Fictíni", context: "Fictíni et Ficti", context_start: 0, decision: null, edited: null, ...extra });
  const cs = {
    schema: "crmedr-changeset/v1" as const, generated_by: "scripts/extract_mentions.py",
    base: { edition: "martyrologium_romanum_2004", registry: "data/mentions.json" },
    operations: [op("e|mr:0101-a|text|0", "mr:0101-a"), op("e|mr:0315-b|text|0", "mr:0315-b")],
  };

  it("knows a change-set that quotes the text", () => {
    expect(quotesText(cs)).toBe(true);
    expect(quotesText({ ...cs, operations: [{ op: "resolve_place", id: "x", decision: null }] })).toBe(false);
  });

  it("refuses to write a change-set that quotes the text into the public repo, before writing anything", () => {
    const dir = mkdtempSync(join(tmpdir(), "cs-"));
    expect(() => writeBundle(cs, "mentions-review", { byMonth: true, dir, isPublic: true })).toThrow(/--private/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("writes a private bundle by month, without an index, replacing the earlier months", () => {
    const dir = mkdtempSync(join(tmpdir(), "cs-"));
    writeFileSync(join(dir, "mentions-review-07.json"), "{}"); // a month now without operations
    const written = writeBundle(cs, "mentions-review", { byMonth: true, dir, isPublic: false });
    expect(written.map((f) => f.split(/[\\/]/).pop())).toEqual(["mentions-review-01.json", "mentions-review-03.json"]);
    expect(readdirSync(dir).sort()).toEqual(["mentions-review-01.json", "mentions-review-03.json"]);
    expect(existsSync(join(dir, "index.json"))).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, "mentions-review-03.json"), "utf8")).operations).toHaveLength(1);
  });

  it("still writes a public change-set with its index", () => {
    const dir = mkdtempSync(join(tmpdir(), "cs-"));
    const places = { ...cs, operations: [{ op: "resolve_place", id: "Fictópoli", decision: null, edited: null }] };
    writeBundle(places, "gazetteer-review", { byMonth: false, dir, isPublic: true });
    expect(JSON.parse(readFileSync(join(dir, "index.json"), "utf8"))).toEqual({ changesets: ["gazetteer-review.json"] });
  });

  it("refuses --private without CHANGESETS_DIR, and writes nothing", () => {
    const work = mkdtempSync(join(tmpdir(), "cs-"));
    const src = join(work, "src.json");
    writeFileSync(src, JSON.stringify(cs));
    expect(() => main([src, "mentions-review", "martyrologium_romanum_2004", "--by-month", "--private"], {})).toThrow(/CHANGESETS_DIR/);
    expect(readdirSync(work)).toEqual(["src.json"]);
  });

  it("refuses a private directory inside the repository, absolute or relative, and writes nothing", () => {
    for (const dir of [join(process.cwd(), "changesets", "zz-private-test"), "changesets/zz-private-test", "changesets", "."]) {
      const before = readdirSync("changesets").sort();
      expect(() => writeBundle(cs, "mentions-review", { byMonth: true, dir, isPublic: false })).toThrow(/inside this public repository/);
      expect(readdirSync("changesets").sort()).toEqual(before);
    }
    expect(existsSync(join("changesets", "zz-private-test"))).toBe(false);
  });
});
