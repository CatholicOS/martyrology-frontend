import { describe, it, expect, vi, beforeEach } from "vitest";

const { viewerMock } = vi.hoisted(() => ({ viewerMock: vi.fn() }));
vi.mock("@/lib/viewer", () => ({ getViewer: viewerMock }));
vi.mock("@/lib/changesets", () => ({
  listChangesets: vi.fn(async () => ["a.json"]),
  readChangeset: vi.fn(async (name: string) => (name === "a.json" ? '{"operations":[]}' : null)),
}));

import { GET as list } from "@/app/api/changesets/route";
import { GET as one } from "@/app/api/changesets/[name]/route";

const ctx = (name: string) => ({ params: Promise.resolve({ name }) });

describe("/api/changesets", () => {
  beforeEach(() => {
    viewerMock.mockReset();
  });

  it("is a 404 for anyone but a curator", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: false });
    expect((await list()).status).toBe(404);
    expect((await one(new Request("http://x"), ctx("a.json"))).status).toBe(404);
    viewerMock.mockResolvedValue({ signedIn: false, curator: false });
    expect((await one(new Request("http://x"), ctx("a.json"))).status).toBe(404);
  });

  it("serves a curator the index and a listed change-set, never cached", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: true });
    const l = await list();
    expect(l.status).toBe(200);
    expect(await l.json()).toEqual({ changesets: ["a.json"] });
    expect(l.headers.get("cache-control")).toBe("private, no-store");
    const o = await one(new Request("http://x"), ctx("a.json"));
    expect(o.status).toBe(200);
    expect(await o.text()).toBe('{"operations":[]}');
    expect(o.headers.get("content-type")).toContain("application/json");
    expect(o.headers.get("cache-control")).toBe("private, no-store");
  });

  it("is a 404 for a curator asking for an unlisted change-set", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: true });
    expect((await one(new Request("http://x"), ctx("nope.json"))).status).toBe(404);
  });
});
