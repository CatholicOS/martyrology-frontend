import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
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

/**
 * A file that is already a crmedr-changeset/v1 document (e.g. crmedr's
 * data/gazetteer_review.json) is bundled as it is; a CRMEDR manifest is converted.
 * @param {any} json
 * @param {{edition: string, registry: string}} base
 */
export function toBundledChangeset(json, base) {
  if (json && json.schema === "crmedr-changeset/v1") return json;
  return convertManifest(json, base);
}

/**
 * A large change-set as one per month, for the Review page to open a month at a time: each part
 * keeps the change-set's header and the operations of one month, from the operation's `day`
 * ("MM-DD") or else its ID ("mr:MMDD-…"); a month without operations has no part.
 * @param {import("../lib/changeset.ts").Changeset} cs
 * @param {string} name
 * @returns {{name: string, changeset: import("../lib/changeset.ts").Changeset}[]}
 */
export function splitByMonth(cs, name) {
  /** @type {Map<string, any[]>} */
  const byMonth = new Map();
  for (const op of cs.operations) {
    const mm = (typeof op.day === "string" && op.day.slice(0, 2)) || /^mr:(\d{2})/.exec(String(op.eulogy ?? op.id))?.[1];
    if (!mm) throw new Error(`no month for operation ${op.id}`);
    byMonth.set(mm, [...(byMonth.get(mm) ?? []), op]);
  }
  return [...byMonth.keys()].sort().map((mm) => ({ name: `${name}-${mm}`, changeset: { ...cs, operations: byMonth.get(mm) } }));
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const byMonth = process.argv.includes("--by-month");
  const args = process.argv.slice(2).filter((a) => a !== "--by-month");
  const src = args[0] ?? join(here, "..", "..", "crmedr", "data", "deprecated_id_corrections.json");
  const name = args[1] ?? "deprecated-id-normalization";
  const edition = args[2] ?? "martyrologium_romanum_1749";
  const cs = toBundledChangeset(JSON.parse(readFileSync(src, "utf8")), { edition, registry: "crmedr@local" });
  const destDir = join(here, "..", "changesets");
  mkdirSync(destDir, { recursive: true });
  if (byMonth) {
    // A month now without operations must not keep its earlier part.
    for (const f of readdirSync(destDir)) if (new RegExp(`^${name}-\\d{2}\\.json$`).test(f)) unlinkSync(join(destDir, f));
    for (const part of splitByMonth(cs, name)) {
      const dest = join(destDir, `${part.name}.json`);
      writeFileSync(dest, JSON.stringify(part.changeset) + "\n"); // compact: these are large
      console.log(`wrote ${dest}: ${part.changeset.operations.length} operations`);
    }
  } else {
    const dest = join(destDir, `${name}.json`);
    writeFileSync(dest, JSON.stringify(cs, null, 1) + "\n");
    console.log(`wrote ${dest}: ${cs.operations.length} operations (${basename(src)})`);
  }
  writeIndex(destDir);
}

/**
 * Regenerate changesets/index.json — the manifest the Review page
 * fetches (through the curator-only /api/changesets) to populate its
 * bundled change-set picker. Lists every
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
