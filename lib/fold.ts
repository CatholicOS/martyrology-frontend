/** Letters with a stroke or bar rather than a mark, which NFD leaves whole: Vietnamese đ, Icelandic ð, Polish ł, Danish ø. */
const STROKE: Record<string, string> = { đ: "d", ð: "d", ł: "l", ø: "o" };

/**
 * Text as a search compares it: lower case, without accents or marks, with æ/œ spelled out and the
 * stroke letters made plain, so "le van phung" finds "Lê Văn Phụng", "dinh" finds "Đinh" and
 * "caecilia" finds "Cæcilia". Marks go first: an accented ligature (ǽ) only becomes a plain æ once
 * its accent is stripped.
 */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/[đðłø]/g, (c) => STROKE[c]);
}
