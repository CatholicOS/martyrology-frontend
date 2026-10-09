/** A country's name in `locale`; undefined for an empty code or one that is not a region code. */
export function regionName(locale: string, code: string): string | undefined {
  try {
    return code ? new Intl.DisplayNames([locale], { type: "region" }).of(code) : undefined;
  } catch {
    return undefined;
  }
}
