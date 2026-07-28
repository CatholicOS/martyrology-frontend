import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} ManifestRow
 * @property {string} old_id
 * @property {string} [new_id]
 * @property {string} action
 * @property {string} [new_subject_la]
 * @property {string} [class]
 * @property {string} [confidence]
 * @property {string} [incipit]
 * @property {string} [reasoning]
 *
 * @param {ManifestRow[]} manifest
 * @param {{edition: string, registry: string}} base
 * @returns {import("../lib/changeset.ts").Changeset}
 */
export function convertManifest(manifest, base) {
  const operations = manifest.map((r) => {
    const common = {
      class: r.class ?? null,
      confidence: r.confidence ?? null,
      incipit: r.incipit ?? "",
      reasoning: r.reasoning ?? "",
      decision: null,
      edited: null,
    };
    if (r.action === "rename") {
      return { op: "rename", id: r.old_id, new_id: r.new_id, subject_la: r.new_subject_la ?? "", ...common };
    }
    if (r.action === "delete" && r.class === "M-merge") {
      return { op: "merge", ids: [r.old_id], winner: r.new_id, ...common };
    }
    if (r.action === "delete") {
      return { op: "delete", id: r.old_id, reason: r.class === "G-rubric" ? "rubric" : (r.class ?? "delete"), ...common };
    }
    return { op: "unknown", id: r.old_id, ...common };
  });
  return { schema: "crmedr-changeset/v1", generated_by: "claude-code", base, operations };
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = process.argv[2] ?? join(here, "..", "..", "crmedr", "data", "deprecated_id_corrections.json");
  const name = process.argv[3] ?? "deprecated-id-normalization";
  const edition = process.argv[4] ?? "martyrologium_romanum_1749";
  const manifest = JSON.parse(readFileSync(src, "utf8"));
  const cs = convertManifest(manifest, { edition, registry: "crmedr@local" });
  const destDir = join(here, "..", "public", "changesets");
  const dest = join(destDir, `${name}.json`);
  mkdirSync(destDir, { recursive: true });
  writeFileSync(dest, JSON.stringify(cs, null, 1) + "\n");
  console.log(`wrote ${dest}: ${cs.operations.length} operations (${basename(src)})`);
  writeIndex(destDir);
}

/**
 * Regenerate public/changesets/index.json — the manifest the Review page
 * fetches to populate its bundled change-set picker. Lists every
 * `*.json` file in the changesets directory except the index itself.
 * @param {string} destDir
 */
function writeIndex(destDir) {
  const files = readdirSync(destDir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort();
  const indexPath = join(destDir, "index.json");
  writeFileSync(indexPath, JSON.stringify({ changesets: files }, null, 1) + "\n");
  console.log(`wrote ${indexPath}: ${files.length} changeset(s)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
