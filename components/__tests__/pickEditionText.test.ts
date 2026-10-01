import { describe, it, expect } from "vitest";
import { pickEditionText } from "@/components/EulogyView";
import type { EulogyOut } from "@/lib/types";

function eulogy(editions: Record<string, string | null>): EulogyOut {
  return {
    id: "mr:0101-fictus",
    subject: { la: "Fictus" },
    editions: Object.fromEntries(Object.entries(editions).map(([id, text]) => [id, { text }])),
  } as unknown as EulogyOut;
}

const all = {
  martyrologium_romanum_1749: "old text",
  martyrologium_romanum_2004: "new text",
  martyrologium_romanum_2004_it_IT: "testo nuovo",
};

describe("pickEditionText", () => {
  it("picks the preferred edition, then the base edition", () => {
    expect(pickEditionText(eulogy(all), "martyrologium_romanum_1749", "martyrologium_romanum_2004")).toEqual({
      text: "new text",
      editionId: "martyrologium_romanum_2004",
      isFallback: false,
    });
    expect(pickEditionText(eulogy(all), "martyrologium_romanum_1749")).toEqual({
      text: "old text",
      editionId: "martyrologium_romanum_1749",
      isFallback: false,
    });
  });

  it("flags a fallback when the wanted edition has no text", () => {
    const e = eulogy({ ...all, martyrologium_romanum_2004: null });
    expect(pickEditionText(e, "martyrologium_romanum_2004")).toEqual({
      text: "old text",
      editionId: "martyrologium_romanum_1749",
      isFallback: true,
    });
  });

  it("flags a fallback when the base names no edition id at all", () => {
    // crmedr's gazetteer queue once declared base.edition "2004": no eulogy has
    // an edition by that name, so the curator saw the 1749 text instead.
    expect(pickEditionText(eulogy(all), "2004").isFallback).toBe(true);
  });
});
