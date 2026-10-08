import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "__tests__" || f === "node_modules" ? [] : files(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("internal links keep the locale", () => {
  it("nothing outside i18n/ imports Link from next/link or locale-blind navigation from next/navigation", () => {
    const bad = [...files("app"), ...files("components"), ...files("lib"), "mdx-components.tsx"].filter((f) => {
      const s = readFileSync(f, "utf8");
      return /from "next\/link"/.test(s) || /import \{[^}]*\b(useRouter|usePathname|redirect)\b[^}]*\} from "next\/navigation"/.test(s);
    });
    expect(bad).toEqual([]);
  });
  it("no internal path is set as a raw <a href>", () => {
    const bad = [...files("components"), "mdx-components.tsx"].filter((f) => /<a\s[^>]*href=\{?[`"]\/(read|map|docs|compare|review|scalar)/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
  it("no internal path is assigned imperatively to an href (use getPathname)", () => {
    const bad = [...files("components"), ...files("lib")]
      .filter((f) => !f.startsWith("lib/i18n") && !f.startsWith("i18n"))
      .filter((f) => /\.href\s*=\s*[`"]\/|\bhref\s*=\s*`\$\{dayPath\(/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
