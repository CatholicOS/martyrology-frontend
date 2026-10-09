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

/**
 * Whether a change-set quotes an edition's text: its operations carry a `context` (crmedr's mentions
 * review quotes the 2004 edition), so it must never be written into this public repo.
 * @param {import("../lib/changeset.ts").Changeset} cs
 */
export function quotesText(cs) {
  return cs.operations.some((op) => typeof op.context === "string");
}

/**
 * Write a change-set into `dir`, whole or one file per month. The repo's changesets/ (`isPublic`) gets
 * its index regenerated; CHANGESETS_DIR needs none (every *.json there is listed). A change-set that
 * quotes the text is refused for the repo before anything is written. Returns the paths written.
 * @param {import("../lib/changeset.ts").Changeset} cs
 * @param {string} name
 * @param {{byMonth: boolean, dir: string, isPublic: boolean}} options
 * @returns {string[]}
 */
export function writeBundle(cs, name, { byMonth, dir, isPublic }) {
  if (isPublic && quotesText(cs)) {
    throw new Error(`${name} quotes the text (its operations carry context): bundle it with --private into CHANGESETS_DIR, never into this public repo`);
  }
  mkdirSync(dir, { recursive: true });
  const written = [];
  if (byMonth) {
    // A month now without operations must not keep its earlier part.
    for (const f of readdirSync(dir)) if (new RegExp(`^${name}-\\d{2}\\.json$`).test(f)) unlinkSync(join(dir, f));
    for (const part of splitByMonth(cs, name)) {
      const dest = join(dir, `${part.name}.json`);
      writeFileSync(dest, JSON.stringify(part.changeset) + "\n"); // compact: these are large
      written.push(dest);
    }
  } else {
    const dest = join(dir, `${name}.json`);
    writeFileSync(dest, JSON.stringify(cs, null, 1) + "\n");
    written.push(dest);
  }
  if (isPublic) written.push(writeIndex(dir));
  return written;
}

/**
 * @param {string[]} argv the arguments after the script's name
 * @param {Record<string, string | undefined>} env
 */
export function main(argv = process.argv.slice(2), env = process.env) {
  const here = dirname(fileURLToPath(import.meta.url));
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const args = argv.filter((a) => !a.startsWith("--"));
  const src = args[0] ?? join(here, "..", "..", "crmedr", "data", "deprecated_id_corrections.json");
  const name = args[1] ?? "deprecated-id-normalization";
  const edition = args[2] ?? "martyrologium_romanum_1749";
  const isPublic = !flags.has("--private");
  const dir = isPublic ? join(here, "..", "changesets") : env.CHANGESETS_DIR;
  if (!dir) throw new Error("--private writes into CHANGESETS_DIR, which is not set");
  const cs = toBundledChangeset(JSON.parse(readFileSync(src, "utf8")), { edition, registry: "crmedr@local" });
  for (const f of writeBundle(cs, name, { byMonth: flags.has("--by-month"), dir, isPublic })) console.log(`wrote ${f}`);
  console.log(`${cs.operations.length} operations (${basename(src)})`);
}

/**
 * Regenerate changesets/index.json — the manifest the Review page
 * fetches (through the curator-only /api/changesets) to populate its
 * bundled change-set picker. Lists every
 * `*.json` file in the changesets directory except the index itself.
 * @param {string} destDir
 * @returns {string} the index's path
 */
function writeIndex(destDir) {
  const files = readdirSync(destDir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort();
  const indexPath = join(destDir, "index.json");
  writeFileSync(indexPath, JSON.stringify({ changesets: files }, null, 1) + "\n");
  return indexPath;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
