import { describe, it, expect } from "vitest";
import { splitUrl } from "@/lib/text-url";

describe("splitUrl", () => {
  it("returns plain text as one text part", () => {
    expect(splitUrl("Copyrighted texts")).toEqual([{ text: "Copyrighted texts" }]);
  });
  it("makes a bare URL a link", () => {
    expect(splitUrl("https://example.org/a")).toEqual([{ text: "https://example.org/a", href: "https://example.org/a" }]);
  });
  it("links the URL inside a sentence, leaving trailing punctuation outside", () => {
    expect(splitUrl("Key required. See https://example.org/lic.")).toEqual([
      { text: "Key required. See " },
      { text: "https://example.org/lic", href: "https://example.org/lic" },
      { text: "." },
    ]);
  });
  it("ignores non-http schemes", () => {
    expect(splitUrl("javascript:alert(1)")).toEqual([{ text: "javascript:alert(1)" }]);
  });
});
