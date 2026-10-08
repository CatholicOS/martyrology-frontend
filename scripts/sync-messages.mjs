// Brings every messages/<locale>.json to en.json's keys: a missing key gets the English text (to translate),
// a key en.json no longer has is dropped. Translated values are kept. Run after adding English strings.
import { readFileSync, writeFileSync } from "node:fs";
const LOCALES = ["it", "fr", "de", "es", "pt"];
const read = (l) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));
const en = read("en");
function merge(src, cur) {
  const out = {};
  for (const [k, v] of Object.entries(src))
    out[k] = typeof v === "string" ? (typeof cur?.[k] === "string" ? cur[k] : v) : merge(v, typeof cur?.[k] === "object" ? cur[k] : {});
  return out;
}
for (const l of LOCALES) writeFileSync(`messages/${l}.json`, JSON.stringify(merge(en, read(l)), null, 2) + "\n");
