import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "components/docs/docs.module.css"), "utf8");

describe("the docs stylesheet", () => {
  it("lightens the rubric red on the dark page, where #a3161b falls below AA contrast", () => {
    const dark = /@media \(prefers-color-scheme: dark\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(dark).toMatch(/\.rubric\s*\{[^}]*color:/);
  });
});
