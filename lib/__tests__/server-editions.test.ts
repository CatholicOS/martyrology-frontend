import { describe, it, expect, vi, afterEach } from "vitest";
import { editionMeta } from "@/lib/server-editions";

afterEach(() => vi.restoreAllMocks());

describe("editionMeta", () => {
  it("returns the title-cased name and year of a known edition", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ editions: [{ edition_id: "mr1749", year: 1749, locale: "la" }] })),
    );
    expect(await editionMeta("mr1749")).toEqual({ title: "Martyrologium Romanum", year: 1749 });
  });
  it("is null for an unknown edition or when unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ editions: [] })));
    expect(await editionMeta("x")).toBeNull();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect(await editionMeta("x")).toBeNull();
  });
});
