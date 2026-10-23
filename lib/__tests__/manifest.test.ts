// @vitest-environment node
import fs from "node:fs";
import { describe, it, expect } from "vitest";
import manifest from "@/app/manifest";
import { appleWebApp, appViewport } from "@/lib/app-metadata";

describe("app manifest", () => {
  it("manifest has the Latin app identity", () => {
    const m = manifest();
    expect(m).toMatchObject({
      id: "/",
      name: "Martyrologium Romanum",
      short_name: "Martyrologium",
      lang: "la",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#E8DCC3",
      theme_color: "#ffffff",
    });
    expect("description" in m).toBe(false);
  });

  it("manifest lists the four icons", () => {
    expect(manifest().icons).toEqual([
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });

  it("every icon exists", () => {
    for (const { src } of manifest().icons ?? []) expect([src, fs.existsSync(`public${src}`)]).toEqual([src, true]);
  });
});

describe("app metadata", () => {
  it("the title bar follows the reader's theme", () => {
    expect(appViewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#020617" },
    ]);
  });

  it("iOS gets the Latin short name", () => {
    expect(appleWebApp).toEqual({ capable: true, title: "Martyrologium", statusBarStyle: "default" });
  });
});
