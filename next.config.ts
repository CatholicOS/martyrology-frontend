import type { NextConfig } from "next";

const config: NextConfig = {
  // Required by the deploy: Plesk's Node extension runs this app under
  // Passenger from a plain directory, with no `npm ci` step on the VPS (the
  // subscription user's shell is too restricted to run one). `standalone`
  // emits a self-contained server.js plus a pruned node_modules, so the
  // deployed tarball needs nothing installed on the remote host.
  // See docs/superpowers/specs/2026-08-02-frontend-deployment-design.md.
  output: "standalone",
};

export default config;
