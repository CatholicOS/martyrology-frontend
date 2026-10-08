import { describe, it, expect } from "vitest";
import { erratumPlace, splitErrata } from "@/lib/errata";
import en from "@/messages/en.json";
import { createTranslator } from "next-intl";
import type { Erratum } from "@/lib/types";

const t = createTranslator({ locale: "en", messages: en, namespace: "Reader" });

const er = (kind: Erratum["kind"], printed: string, corrected = "", ref = "81.20"): Erratum => ({
  kind, printed, corrected, ref, entry: `${ref}. ${printed}, ${corrected}.`,
});

describe("splitErrata", () => {
  it("sets a replacement's printed words apart", () => {
    const out = splitErrata([{ text: "Cononiæ sanctæ Iulianæ." }], [er("replace", "Cononiæ", "Bononiæ")]);
    expect(out.map((s) => [s.text, s.erratum?.corrected])).toEqual([["Cononiæ", "Bononiæ"], [" sanctæ Iulianæ.", undefined]]);
  });

  it("marks where an addition goes, right after the phrase it follows", () => {
    const out = splitErrata([{ text: "Item beatæ Dafrosæ." }], [er("add", "Item", "Romæ", "13.4")]);
    expect(out.map((s) => [s.text, s.erratum?.kind])).toEqual([["Item", undefined], ["", "add"], [" beatæ Dafrosæ.", undefined]]);
  });

  it("marks where an addition that opens the eulogy goes, right before the phrase", () => {
    const e = { ...er("add", "In Persia", "Item", "197.12"), position: "before" as const };
    const out = splitErrata([{ text: "In Persia sanctorum Parmenij." }], [e]);
    expect(out.map((s) => [s.text, s.erratum?.kind])).toEqual([["", "add"], ["In Persia sanctorum Parmenij.", undefined]]);
  });

  it("marks a deletion, even of the whole text", () => {
    const out = splitErrata([{ text: "Bergŏmi sancti Domnônis martyris." }], [er("delete", "Bergŏmi sancti Domnônis martyris.")]);
    expect(out).toHaveLength(1);
    expect(out[0].erratum?.kind).toBe("delete");
  });

  it("leaves unmarked a phrase that isn't once in the text as whole words, or is inside a misprint", () => {
    expect(splitErrata([{ text: "Romæ, Romæ." }], [er("add", "Romæ", "Sancti")])).toEqual([{ text: "Romæ, Romæ." }]);
    expect(splitErrata([{ text: "Cononiæ", intended: "x" }], [er("replace", "Cononiæ", "Bononiæ")])).toEqual([
      { text: "Cononiæ", intended: "x" },
    ]);
  });
});

describe("erratumPlace", () => {
  it("reads the printed page and line", () => {
    expect(erratumPlace(t, "81.20")).toBe("p. 81, l. 20");
    expect(erratumPlace(t, "vbique")).toBe("everywhere");
  });
});
