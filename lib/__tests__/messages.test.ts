import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES } from "@/i18n/routing";

type Tree = { [k: string]: string | Tree };
const load = (l: string): Tree => JSON.parse(readFileSync(join(process.cwd(), "messages", `${l}.json`), "utf8"));
function flat(t: Tree, p = ""): Record<string, string> {
  return Object.entries(t).reduce<Record<string, string>>((o, [k, v]) =>
    typeof v === "string" ? { ...o, [p + k]: v } : { ...o, ...flat(v, `${p}${k}.`) }, {});
}
/** ICU argument names: "{count, plural, …}", "{year}" → count, year. */
const args = (m: string) => [...new Set([...m.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((x) => x[1]))].sort();

const en = flat(load("en"));

describe("messages", () => {
  for (const l of LOCALES.filter((x) => x !== "en")) {
    const other = flat(load(l));
    it(`${l} has exactly the English keys`, () => expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort()));
    it(`${l} keeps every ICU argument`, () => {
      for (const k of Object.keys(en)) expect([k, args(other[k] ?? "")]).toEqual([k, args(en[k])]);
    });
  }
});
