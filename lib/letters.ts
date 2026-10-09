/** A letter of an index (A–Z, another letter, or "#") as it stands in a URL: lowercase, "#" as "other". */
export function letterSlug(letter: string): string {
  return letter === "#" ? "other" : encodeURIComponent(letter.toLowerCase());
}

/** The index's letter a URL names, whatever its case; null when the index has no such letter. */
export function letterFromSlug(slug: string, letters: readonly string[]): string | null {
  const wanted = decodeURIComponent(slug).toLowerCase();
  return letters.find((l) => decodeURIComponent(letterSlug(l)) === wanted) ?? null;
}

/** The letters before and after `letter` among those the index has. */
export function letterNeighbours(letters: readonly string[], letter: string): { prev: string | null; next: string | null } {
  const i = letters.indexOf(letter);
  return { prev: i > 0 ? letters[i - 1] : null, next: i >= 0 && i < letters.length - 1 ? letters[i + 1] : null };
}

/** A letter as a URL names it, for a title: "b" → "B", "other" → "#". */
export function slugLetter(slug: string): string {
  return slug === "other" ? "#" : decodeURIComponent(slug).toUpperCase();
}
