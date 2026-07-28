import { describe, it, expect } from "vitest";
import { buildSnapshot } from "@/scripts/snapshot-registry.mjs";

const registry = { entries: [
  { id: "mr:0104-titus", month: 1, day: 4, entry: 2, asterisk: false, country: "GR" },
  { id: "mr:0101-circumcisio-domini", month: 1, day: 1, entry: 1, deprecated: true, attested_in: "martyrologium_romanum_1749", country: null, unnumbered: true },
]};
const la = { "mr:0104-titus": "Sanctus Titus", "mr:0101-circumcisio-domini": "Circumcisio Domini" };
const itSubj = { "mr:0104-titus": "", "mr:0101-circumcisio-domini": "" };
const en = { "mr:0104-titus": "Saint Titus", "mr:0101-circumcisio-domini": "" };

describe("buildSnapshot", () => {
  it("merges registry + i18n into per-id entries", () => {
    const snap = buildSnapshot(registry, la, itSubj, en);
    expect(snap["mr:0104-titus"]).toEqual({
      deprecated: false, month: 1, day: 4, entry: 2, asterisk: false, unnumbered: false,
      country: "GR", attested_in: null, subject: { la: "Sanctus Titus", it: "", en: "Saint Titus" },
    });
    expect(snap["mr:0101-circumcisio-domini"].deprecated).toBe(true);
    expect(snap["mr:0101-circumcisio-domini"].attested_in).toBe("martyrologium_romanum_1749");
  });
});
