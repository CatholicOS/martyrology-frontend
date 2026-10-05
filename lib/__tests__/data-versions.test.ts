import { describe, it, expect, vi, afterEach } from "vitest";
import { getDataVersions } from "@/lib/data-versions";

afterEach(() => vi.restoreAllMocks());

const health = {
  status: "ok",
  version: "0.11.8",
  data: { crmedr: "de362d03dce96ef92811b55b2a335c38b717576f", clbdr: "ecb147b", texts: "7934eba" },
};

describe("getDataVersions", () => {
  it("reads the API's version and the CRMEDR commit from /healthz", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(health)));
    expect(await getDataVersions()).toEqual({ api: "0.11.8", crmedr: "de362d03dce96ef92811b55b2a335c38b717576f" });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/healthz$/);
  });

  it("asks with a deadline, so a hung API cannot hold up every page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(health)));
    await getDataVersions();
    const init = fetchMock.mock.calls[0][1] as RequestInit & { next?: { revalidate?: number } };
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.next?.revalidate).toBe(300);
  });

  it("is null when the deadline passes", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await getDataVersions()).toBeNull();
  });

  it("is null when the API cannot be asked or answers without them", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect(await getDataVersions()).toBeNull();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("oops", { status: 503 }));
    expect(await getDataVersions()).toBeNull();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "ok" })));
    expect(await getDataVersions()).toBeNull();
    for (const bad of [{ version: 11, data: { crmedr: "abc" } }, { version: "0.11.8", data: { crmedr: {} } }, { version: "", data: { crmedr: "abc" } }]) {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(bad)));
      expect(await getDataVersions()).toBeNull();
    }
  });
});
