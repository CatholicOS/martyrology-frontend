import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEditions, getCatalog, ApiError } from "@/lib/api";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("api client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("getEditions hits the proxy and unwraps editions[]", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockReturnValue(json({ editions: [{ edition_id: "x", year: 1749 }] }) as never);
    const eds = await getEditions();
    expect(spy).toHaveBeenCalledWith("/api/mr/editions", expect.anything());
    expect(eds[0].edition_id).toBe("x");
  });

  it("getCatalog passes edition + locale as query", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockReturnValue(json({ elogia: [] }) as never);
    await getCatalog("martyrologium_romanum_1749", "la");
    expect(spy).toHaveBeenCalledWith("/api/mr/elogia?edition=martyrologium_romanum_1749&locale=la", expect.anything());
  });

  it("throws ApiError on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(json({ title: "Unknown edition" }, 404) as never);
    await expect(getCatalog("nope", "la")).rejects.toBeInstanceOf(ApiError);
  });
});
