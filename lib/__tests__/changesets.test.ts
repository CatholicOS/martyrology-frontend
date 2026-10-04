import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listChangesets, readChangeset } from "@/lib/changesets";

let root: string, bundled: string, priv: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "changesets-"));
  bundled = join(root, "bundled");
  priv = join(root, "private");
  mkdirSync(bundled);
  mkdirSync(priv);
  writeFileSync(join(bundled, "index.json"), JSON.stringify({ changesets: ["a.json"] }));
  writeFileSync(join(bundled, "a.json"), '{"from":"bundled"}');
  writeFileSync(join(bundled, "unlisted.json"), "{}");
  writeFileSync(join(priv, "b.json"), '{"from":"private"}');
  writeFileSync(join(priv, "notes.txt"), "not a change-set");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("changesets", () => {
  it("lists the bundled index and every JSON file of the private directory", async () => {
    expect(await listChangesets(bundled, priv)).toEqual(["a.json", "b.json"]);
  });
  it("lists only the bundled ones without a private directory, or when it is missing", async () => {
    expect(await listChangesets(bundled, "")).toEqual(["a.json"]);
    expect(await listChangesets(bundled, join(root, "missing"))).toEqual(["a.json"]);
  });
  it("lists nothing when there is no index and no private directory", async () => {
    expect(await listChangesets(join(root, "missing"), "")).toEqual([]);
  });
  it("reads a change-set from whichever directory lists it", async () => {
    expect(await readChangeset("a.json", bundled, priv)).toBe('{"from":"bundled"}');
    expect(await readChangeset("b.json", bundled, priv)).toBe('{"from":"private"}');
  });
  it("refuses names outside the listings, including paths", async () => {
    expect(await readChangeset("unlisted.json", bundled, priv)).toBeNull();
    expect(await readChangeset("../bundled/a.json", bundled, priv)).toBeNull();
    expect(await readChangeset("notes.txt", bundled, priv)).toBeNull();
  });
  it("lists a private change-set named index.json (only the bundled directory has an index)", async () => {
    writeFileSync(join(priv, "index.json"), '{"from":"private index"}');
    expect(await listChangesets(bundled, priv)).toEqual(["a.json", "b.json", "index.json"]);
    expect(await readChangeset("index.json", bundled, priv)).toBe('{"from":"private index"}');
    rmSync(join(priv, "index.json"));
  });
});
