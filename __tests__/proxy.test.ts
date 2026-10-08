// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch, getRedirectUrl } from "next/experimental/testing/server";
import proxy, { config } from "@/proxy";
import nextConfig from "@/next.config";

const req = (path: string, headers: Record<string, string> = {}) => new NextRequest(`https://romanmartyrology.com${path}`, { headers });

describe("proxy", () => {
  it("308s the old docs URLs to the locale-prefixed ones", async () => {
    const r = await proxy(req("/docs/it/lunar-table"));
    expect(r.status).toBe(308);
    expect(getRedirectUrl(r)).toBe("https://romanmartyrology.com/it/docs/lunar-table");
    expect(getRedirectUrl(await proxy(req("/docs/en")))).toBe("https://romanmartyrology.com/en/docs");
  });

  it("sends an unprefixed path to the saved locale, keeping the query", async () => {
    const r = await proxy(req("/read/martyrologium_romanum_1630/01/02?with=x", { cookie: "NEXT_LOCALE=de" }));
    expect(r.status).toBe(307);
    expect(getRedirectUrl(r)).toBe("https://romanmartyrology.com/de/read/martyrologium_romanum_1630/01/02?with=x");
    expect(getRedirectUrl(await proxy(req("/", { cookie: "NEXT_LOCALE=pt" })))).toBe("https://romanmartyrology.com/pt");
  });

  it("follows the browser's language when no cookie is saved, else English", async () => {
    expect(getRedirectUrl(await proxy(req("/map", { "accept-language": "fr-CA,fr;q=0.9,en;q=0.5" })))).toBe("https://romanmartyrology.com/fr/map");
    expect(getRedirectUrl(await proxy(req("/map", { "accept-language": "ja" })))).toBe("https://romanmartyrology.com/en/map");
  });

  it("ignores an invalid cookie", async () => {
    expect(getRedirectUrl(await proxy(req("/map", { cookie: "NEXT_LOCALE=xx", "accept-language": "es" })))).toBe("https://romanmartyrology.com/es/map");
  });

  it("serves a prefixed path as asked, and never sets the cookie", async () => {
    for (const [path, h] of [["/es/map", { cookie: "NEXT_LOCALE=de" }], ["/fr/docs", { "accept-language": "it" }]] as const) {
      const r = await proxy(req(path, h));
      expect(getRedirectUrl(r)).toBeNull();
      expect(r.headers.get("set-cookie") ?? "").not.toMatch(/NEXT_LOCALE/);
    }
  });

  it("does not run on route handlers and assets", () => {
    for (const url of ["/api/mr/editions", "/api/auth/session", "/scalar/openapi.json", "/scalar/proxy", "/_next/static/x.js", "/favicon.ico"])
      expect([url, unstable_doesProxyMatch({ config, nextConfig, url })]).toEqual([url, false]);
    for (const url of ["/", "/map", "/it/docs", "/scalar"]) expect([url, unstable_doesProxyMatch({ config, nextConfig, url })]).toEqual([url, true]);
  });
});
