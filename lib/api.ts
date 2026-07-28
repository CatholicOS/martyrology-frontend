import type { EditionOut, CatalogEntryOut, EulogyOut, DayContentOut, Locale } from "@/lib/types";

export class ApiError extends Error {
  constructor(public status: number, public title: string) {
    super(title);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/mr/${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) {
    let title = res.statusText;
    try {
      title = (await res.json()).title ?? title;
    } catch {}
    throw new ApiError(res.status, title);
  }
  return res.json() as Promise<T>;
}

export async function getEditions(): Promise<EditionOut[]> {
  return (await get<{ editions: EditionOut[] }>("editions")).editions;
}

export async function getCatalog(edition: string, locale: Locale): Promise<CatalogEntryOut[]> {
  return (await get<{ elogia: CatalogEntryOut[] }>(`elogia?edition=${encodeURIComponent(edition)}&locale=${locale}`)).elogia;
}

// The /elogium/{id} endpoint has no locale parameter — it returns subjects for ALL
// locales (EulogyOut.subject: {la,it,en}) and all edition placements. Callers select
// the language/edition they need from the returned object.
export async function getElogium(id: string): Promise<EulogyOut> {
  return get<EulogyOut>(`elogium/${encodeURIComponent(id)}`);
}

export async function getDay(edition: string, mm: string, dd: string): Promise<DayContentOut> {
  return get<DayContentOut>(`elogia/edition/${encodeURIComponent(edition)}/${mm}/${dd}`);
}
