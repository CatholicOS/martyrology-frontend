/** A country's name in `locale`; undefined for an empty code or one that is not a region code. */
export function regionName(locale: string, code: string): string | undefined {
  try {
    return code ? new Intl.DisplayNames([locale], { type: "region" }).of(code) : undefined;
  } catch {
    return undefined;
  }
}

/** Several countries' names in `locale` as a list ("Netherlands and Germany"); undefined when none has a name. */
export function regionNames(locale: string, codes: string[]): string | undefined {
  const names = codes.map((c) => regionName(locale, c)).filter((n): n is string => !!n);
  if (names.length === 0) return undefined;
  try {
    return new Intl.ListFormat([locale], { type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}

/** The countries a place lies in: its one country, its several, or none (a macro-area such as the Orient). */
export function placeCountries(p: { country: string; countries?: string[] }): string[] {
  return p.countries?.length ? p.countries : p.country ? [p.country] : [];
}
