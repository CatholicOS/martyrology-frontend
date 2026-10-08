"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import scalarIt from "@/messages/scalar/it.json";
import styles from "@/components/ApiReference.module.css";

// The site follows the system's colour scheme (Tailwind's default `dark:`), and so does the reference.
const DARK = "(prefers-color-scheme: dark)";
const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(DARK);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const prefersDark = () => window.matchMedia(DARK).matches;

// The site's red (rubrics, headings) as the accent, and its text face for headings and prose.
const CUSTOM_CSS = `
.light-mode { --scalar-color-accent: #a3161b; --scalar-background-1: #fff; }
.dark-mode { --scalar-color-accent: #f87171; --scalar-background-1: #020617; }
.scalar-app { --scalar-font: ui-sans-serif, system-ui, sans-serif; --scalar-font-code: ui-monospace, SFMono-Regular, Menlo, monospace; }
`;

/**
 * The API reference (Scalar): the API's OpenAPI document, served by this site at /scalar/openapi.json, and its
 * "Test request" through /scalar/proxy (the API sends no CORS headers).
 */
export default function ApiReference({ locale, title }: { locale: string; title: string }) {
  // null while rendering on the server: Scalar mounts once the scheme is known (it sets the body's light-mode or
  // dark-mode class, which paints the page), and again when it changes.
  const dark = useSyncExternalStore(subscribe, prefersDark, () => null);
  // Scalar marks the body light-mode or dark-mode; leaving the reference, the rest of the site has its own scheme.
  useEffect(() => () => document.body.classList.remove("light-mode", "dark-mode"), []);
  if (dark === null) return <div className={styles.reference} />;
  return (
    <div className={styles.reference}>
      <ApiReferenceReact
        key={`${dark ? "dark" : "light"}-${locale}`}
        configuration={{
          url: "/scalar/openapi.json",
          proxyUrl: "/scalar/proxy",
          theme: "default",
          layout: "modern",
          // Italian is not among Scalar's built-in locales: ours; the others are built in
          localization: locale === "it" ? { locale, translations: scalarIt } : { locale },
          customCss: CUSTOM_CSS,
          forceDarkModeState: dark ? "dark" : "light",
          hideDarkModeToggle: true,
          withDefaultFonts: false,
          telemetry: false,
          // no "Ask AI" (Scalar's hosted agent) and no "Generate MCP" (Scalar's hosted MCP service)
          agent: { disabled: true },
          mcp: { disabled: true },
          showDeveloperTools: "never",
          documentDownloadType: "json",
          defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
          // the page's localized title (Scalar applies this client-side, over the server-rendered one)
          metaData: { title },
        }}
      />
    </div>
  );
}
