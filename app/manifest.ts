import type { MetadataRoute } from "next";

/**
 * The installable app (install only: no service worker). One app in every language, with a Latin name: a manifest
 * per language would rename the app, with a prompt, whenever the reader switched language inside it. It opens at
 * "/", which the proxy sends to the language the reader last picked. The icons: scripts/build-icons.mjs; they live in
 * /app-icons/, never /icons/, which the VPS's Apache aliases to its own icon set on every site.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Martyrologium Romanum",
    short_name: "Martyrologium",
    lang: "la",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#E8DCC3",
    theme_color: "#ffffff",
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/app-icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
