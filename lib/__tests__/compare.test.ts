import { describe, it, expect } from "vitest";
import { buildComparison } from "@/lib/compare";
import type { CatalogEntryOut } from "@/lib/types";
import type { RegistrySnapshot } from "@/lib/snapshot";

const mk = (id: string, day: string, dep = false, entry = 1, anchor = day): CatalogEntryOut =>
  ({ id, subject: id, anchor_day: anchor, deprecated: dep, present: true, day_printed: day, entry });
const snap: RegistrySnapshot = {} as RegistrySnapshot;

describe("buildComparison", () => {
  it("aligns by id within a physical day; flags a-only/b-only with color", () => {
    const a = [mk("mr:0101-x", "01-01"), mk("mr:0101-dep", "01-01", true)];
    const b = [mk("mr:0101-x", "01-01")];
    const groups = buildComparison(a, b, snap);
    const d = groups.find((g) => g.day === "01-01")!;
    expect(d.rows.find((r) => r.id === "mr:0101-x")!.status).toBe("both");
    const dep = d.rows.find((r) => r.id === "mr:0101-dep")!;
    expect(dep.status).toBe("a-only");
    expect(dep.color).toBe("red"); // deprecated -> red
    expect(d.counts.aOnly).toBe(1);
  });

  it("marks cross-day when anchor_day != day_printed", () => {
    const a = [mk("mr:1229-y", "01-02", false, 2, "12-29")];
    const groups = buildComparison(a, [], snap);
    expect(groups[0].day).toBe("01-02");
    expect(groups[0].rows[0].crossDay).toBe(true);
  });

  it("non-deprecated a-only is green", () => {
    const groups = buildComparison([mk("mr:0101-new", "01-01")], [], snap);
    expect(groups[0].rows[0].color).toBe("green");
  });
});
