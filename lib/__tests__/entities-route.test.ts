// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/persons", () => ({ getPersons: () => ({ editions: {}, labels: { Q19546: { en: "Basil of Caesarea" } } }) }));
vi.mock("@/lib/places", () => ({
  getPlaces: () => ({ places: { Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5] } }, eulogies: {} }),
}));
vi.mock("@/lib/person-details", () => ({ getPersonDetails: () => ({}) }));

import { GET } from "@/app/api/entities/route";

const get = (q: string) => GET(new NextRequest(`https://romanmartyrology.com/api/entities${q}`));

describe("/api/entities", () => {
  it("answers with the items asked for, cacheable for an hour", async () => {
    const res = get("?ids=Q220,Q19546,Q404");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    const body = await res.json();
    expect(Object.keys(body.entities).sort()).toEqual(["Q19546", "Q220"]);
    expect(body.entities.Q220).toMatchObject({ kind: "place", coords: [41.9, 12.5] });
  });

  it("answers an empty question with no items", async () => {
    expect(await get("").json()).toEqual({ entities: {} });
  });

  it("is a 400 above 200 items", async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `Q${i + 1}`).join(",");
    const res = get(`?ids=${ids}`);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });
});
