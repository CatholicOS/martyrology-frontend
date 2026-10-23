import type { Metadata, Viewport } from "next";

/** The browser's title bar (and an installed app's window) follows the reader's theme: the site's header colours. */
export const appViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

/** The home-screen app on iOS, named like the manifest's short_name (app/manifest.ts). */
export const appleWebApp: Metadata["appleWebApp"] = { capable: true, title: "Martyrologium", statusBarStyle: "default" };
