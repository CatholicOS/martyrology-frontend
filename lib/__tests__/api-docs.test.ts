import { describe, it, expect, vi, afterEach } from "vitest";
import { proxyTarget, withPublicServer, API_BASE, API_PUBLIC_URL } from "@/lib/api-docs";
import { GET as openapi } from "@/app/scalar/openapi.json/route";
import { GET as proxyGet, POST as proxyPost } from "@/app/scalar/proxy/route";

const PUB = "https://api.example.org";
const BASE = "http://127.0.0.1:8412";

afterEach(() => vi.restoreAllMocks());

describe("the API reference helpers", () => {
  it("sets the public API as the document's only server", () => {
    const doc = withPublicServer({ openapi: "3.1.0", servers: [{ url: "http://internal" }], paths: {} }, PUB);
    expect(doc.servers).toEqual([{ url: PUB, description: "Roman Martyrology API" }]);
    expect(doc.paths).toEqual({});
  });

  it("proxies only to the public API, through the internal base", () => {
    expect(proxyTarget(`${PUB}/api/v1/editions?x=1`, PUB, BASE)).toBe(`${BASE}/api/v1/editions?x=1`);
    expect(proxyTarget(`${PUB}/openapi.json`, PUB, `${BASE}/`)).toBe(`${BASE}/openapi.json`);
    expect(proxyTarget("https://evil.example/api/v1/editions", PUB, BASE)).toBeNull();
    expect(proxyTarget("https://api.example.org.evil.example/x", PUB, BASE)).toBeNull();
    expect(proxyTarget(`https://user:pw@api.example.org/x`, PUB, BASE)).toBeNull();
    expect(proxyTarget("/api/v1/editions", PUB, BASE)).toBeNull();
    expect(proxyTarget(null, PUB, BASE)).toBeNull();
  });
});

const req = (url: string, method = "GET", headers: Record<string, string> = {}) =>
  ({ nextUrl: new URL(url), method, headers: new Headers(headers) }) as never;

describe("/scalar/openapi.json", () => {
  it("serves the API's document with the public server", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ openapi: "3.1.0", paths: {} }));
    const res = await openapi();
    expect(spy).toHaveBeenCalledWith(`${API_BASE}/openapi.json`, expect.anything());
    expect(res.status).toBe(200);
    expect((await res.json()).servers[0].url).toBe(API_PUBLIC_URL);
  });

  it("answers 502 when the API is down", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    expect((await openapi()).status).toBe(502);
  });
});

describe("/scalar/proxy", () => {
  const target = encodeURIComponent(`${API_PUBLIC_URL}/api/v1/editions`);

  it("forwards a GET to the API with the reader's headers, and returns its answer", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"editions":[]}', { status: 200, headers: { "content-type": "application/json", "set-cookie": "x=1" } }),
    );
    const res = await proxyGet(
      req(`http://site.test/scalar/proxy?scalar_url=${target}`, "GET", { authorization: "Bearer t", cookie: "s=1" }),
    );
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE}/api/v1/editions`);
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer t");
    expect(new Headers(init.headers).get("cookie")).toBeNull();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.json()).toEqual({ editions: [] });
  });

  it("refuses other hosts and writes", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const other = await proxyGet(req("http://site.test/scalar/proxy?scalar_url=https%3A%2F%2Fevil.example%2F"));
    expect(other.status).toBe(400);
    const write = proxyPost();
    expect(write.status).toBe(405);
    expect(spy).not.toHaveBeenCalled();
  });
});
