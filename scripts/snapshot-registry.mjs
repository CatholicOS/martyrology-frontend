import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} RegistryEntry
 * @property {string} id
 * @property {number} month
 * @property {number} day
 * @property {number|null} [entry]
 * @property {boolean} [asterisk]
 * @property {boolean} [deprecated]
 * @property {boolean} [unnumbered]
 * @property {string|null} [country]
 * @property {string|null} [attested_in]
 *
 * @typedef {object} SnapshotEntry
 * @property {boolean} deprecated
 * @property {number} month
 * @property {number} day
 * @property {number|null} entry
 * @property {boolean} asterisk
 * @property {boolean} unnumbered
 * @property {string|null} country
 * @property {string|null} attested_in
 * @property {{la: string, it: string, en: string}} subject
 *
 * @param {{entries: RegistryEntry[]}} registry
 * @param {Record<string, string>} la
 * @param {Record<string, string>} it
 * @param {Record<string, string>} en
 * @returns {Record<string, SnapshotEntry>}
 */
export function buildSnapshot(registry, la, it, en) {
  /** @type {Record<string, SnapshotEntry>} */
  const out = {};
  for (const e of registry.entries) {
    out[e.id] = {
      deprecated: Boolean(e.deprecated),
      month: e.month, day: e.day,
      entry: e.entry ?? null,
      asterisk: Boolean(e.asterisk),
      unnumbered: Boolean(e.unnumbered),
      country: e.country ?? null,
      attested_in: e.attested_in ?? null,
      subject: { la: la[e.id] ?? "", it: it[e.id] ?? "", en: en[e.id] ?? "" },
    };
  }
  return out;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const crmedr = process.argv[2] ?? join(here, "..", "..", "crmedr");
  const registry = JSON.parse(readFileSync(join(crmedr, "data", "martyrology_ids.json"), "utf8"));
  const la = JSON.parse(readFileSync(join(crmedr, "i18n", "la.json"), "utf8"));
  const it = JSON.parse(readFileSync(join(crmedr, "i18n", "it.json"), "utf8"));
  const en = JSON.parse(readFileSync(join(crmedr, "i18n", "en.json"), "utf8"));
  const snap = buildSnapshot(registry, la, it, en);
  const dest = join(here, "..", "data", "registry-snapshot.json");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(snap) + "\n");
  console.log(`wrote ${dest}: ${Object.keys(snap).length} ids`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
