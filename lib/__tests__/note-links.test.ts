import { describe, it, expect } from "vitest";
import { noteParts } from "@/lib/note-links";
import type { RegistrySnapshot, SnapshotEntry } from "@/lib/snapshot";

const entry = (month: number, day: number, deprecated = false, attested_in: string | null = null): SnapshotEntry => ({
  deprecated, month, day, entry: 1, asterisk: false, unnumbered: false, country: null, attested_in,
  subject: { la: "", it: "", en: "" },
});
const snap: RegistrySnapshot = {
  "mr:0218-sadoth-et-socii": entry(2, 18),
  "mr:0821-paternus": entry(8, 21),
  "mr:0220-eleutherius-et-socii": entry(2, 20, true, "martyrologium_romanum_1749"),
};
const LA = "martyrologium_romanum_2004";
const Y1749 = "martyrologium_romanum_1749";

describe("noteParts", () => {
  it("links a current ID from a historical page to the 2004 Latin, where it is printed", () => {
    expect(noteParts("Probably mr:0218-sadoth-et-socii: same place.", Y1749, snap)).toEqual([
      { text: "Probably " },
      { text: "mr:0218-sadoth-et-socii", href: "/read/martyrologium_romanum_2004/02/18#mr:0218-sadoth-et-socii" },
      { text: ": same place." },
    ]);
  });

  it("keeps a 2004 page's own edition for a current ID", () => {
    expect(noteParts("mr:0821-paternus", "martyrologium_romanum_2004_it_IT", snap)[0].href).toBe(
      "/read/martyrologium_romanum_2004_it_IT/08/21#mr:0821-paternus",
    );
  });

  it("links a deprecated ID to the edition it is attested in, from any page", () => {
    for (const page of [LA, Y1749, "martyrologium_romanum_1914_en_unofficial"]) {
      expect(noteParts("See mr:0220-eleutherius-et-socii.", page, snap)[1]).toEqual({
        text: "mr:0220-eleutherius-et-socii",
        href: "/read/martyrologium_romanum_1749/02/20#mr:0220-eleutherius-et-socii",
      });
    }
  });

  it("leaves an unknown ID, and text without IDs, as plain text", () => {
    expect(noteParts("No mr:0101-nemo here.", LA, snap)).toEqual([{ text: "No mr:0101-nemo here." }]);
    expect(noteParts("Plain.", LA, snap)).toEqual([{ text: "Plain." }]);
  });

  it("links several IDs, and opens the 2004 Latin when the page has no edition", () => {
    const parts = noteParts("(mr:0821-paternus, mr:0218-sadoth-et-socii)", "", snap);
    expect(parts.filter((p) => p.href).map((p) => p.href)).toEqual([
      "/read/martyrologium_romanum_2004/08/21#mr:0821-paternus",
      "/read/martyrologium_romanum_2004/02/18#mr:0218-sadoth-et-socii",
    ]);
  });
});
