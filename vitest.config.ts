import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], globals: true,
    // next-auth and next-intl import "next/server" extensionless, which Node ESM cannot
    // resolve when externalized; inline it so Vite resolves it instead.
    server: { deps: { inline: ["next-auth", "next-intl"] } },
  },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});
