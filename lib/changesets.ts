import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Change-sets for /review come from two places, and neither is in public/:
 *
 * - changesets/ in this repo: only public-safe ones (the gazetteer queue holds
 *   place designations, which may be quoted). Listed by its index.json, and
 *   traced into the standalone bundle by next.config.ts.
 * - CHANGESETS_DIR, a directory on the server outside the deploy (it survives
 *   redeploys): change-sets whose explanations can quote the copyrighted 2004
 *   edition, so they are never committed to this public repo. Every *.json
 *   file in it is listed.
 *
 * Both are served only to curators, through app/api/changesets.
 */
export const BUNDLED_DIR = join(process.cwd(), "changesets");

async function bundledNames(dir: string): Promise<string[]> {
  try {
    const body = JSON.parse(await readFile(join(dir, "index.json"), "utf8")) as { changesets?: string[] };
    return body.changesets ?? [];
  } catch {
    return [];
  }
}

async function privateNames(dir: string | undefined): Promise<string[]> {
  if (!dir) return [];
  try {
    return (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

/**
 * Every change-set a curator can open: the bundled ones, then the private
 * ones. A name in both is listed once and opens the bundled copy, so give a
 * private change-set a name the repo does not use.
 */
export async function listChangesets(
  bundled = BUNDLED_DIR,
  privateDir = process.env.CHANGESETS_DIR,
): Promise<string[]> {
  const names = [...(await bundledNames(bundled)), ...(await privateNames(privateDir))];
  return [...new Set(names)];
}

/**
 * A listed change-set's JSON text, or null. Only names from the listings are
 * served, so no path is ever built from an unchecked request parameter.
 */
export async function readChangeset(
  name: string,
  bundled = BUNDLED_DIR,
  privateDir = process.env.CHANGESETS_DIR,
): Promise<string | null> {
  const dir = (await bundledNames(bundled)).includes(name)
    ? bundled
    : privateDir && (await privateNames(privateDir)).includes(name)
      ? privateDir
      : null;
  if (!dir) return null;
  try {
    return await readFile(join(dir, name), "utf8");
  } catch {
    return null;
  }
}
