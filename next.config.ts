import type { NextConfig } from "next";

const config: NextConfig = {
  // Required by the deploy: Plesk's Node extension runs this app under
  // Passenger from a plain directory, with no `npm ci` step on the VPS (the
  // subscription user's shell is too restricted to run one). `standalone`
  // emits a self-contained server.js plus a pruned node_modules, so the
  // deployed tarball needs nothing installed on the remote host.
  // See docs/superpowers/specs/2026-08-02-frontend-deployment-design.md.
  output: "standalone",

  // Compensates for a gap between the `sharp` version we pin and the one this
  // Next release traces for.
  //
  // package.json overrides `sharp` to ^0.35.3 to clear GHSA-f88m-g3jw-g9cj
  // (four libvips CVEs); next@16.2.12 itself pins ^0.34.5. In 0.34 libvips is
  // linked into the .node binary, so tracing the binary was enough. 0.35 moves
  // it into a separate libvips-cpp.so loaded through dlopen — which Next's
  // tracer does not follow, because it resolves `require` graphs, not dynamic
  // library loads.
  //
  // The failure this prevents is quiet and asymmetric: the bundle builds, every
  // route serves, and the app is fine right up until something actually calls
  // sharp, which then throws ERR_DLOPEN_FAILED for a missing
  // libvips-cpp.so.8.18.3. It cannot reproduce in development, where the full
  // node_modules is on disk — only in the deployed bundle. The tell is the
  // bundle silently shrinking by ~7MB.
  //
  // Removable once Next ships a stable release pinning sharp ^0.35.x (canary
  // already does), at which point its own tracing covers this.
  outputFileTracingIncludes: {
    // Deliberately the linux-x64 path only: that is the deploy target, and the
    // workflow pins the runner to ubuntu-24.04 to match it. On any other
    // platform this glob matches nothing, which is harmless.
    "*": ["./node_modules/@img/sharp-libvips-linux-x64/lib/*"],
  },
};

export default config;
