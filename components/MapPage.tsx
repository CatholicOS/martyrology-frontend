"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import EulogyMap from "@/components/EulogyMap";
import MapSidebar from "@/components/MapSidebar";
import { getCatalog, getEditions } from "@/lib/api";
import { describeError } from "@/lib/describe-error";
import { editionLang, isOriginal, sortForShelf } from "@/lib/editions";
import { facetCounts, filterEntries, mapEntries, type MapEntry, type MapFilters } from "@/lib/map-data";
import { getPlaces } from "@/lib/places";
import { getSnapshot } from "@/lib/snapshot";
import { subjectFor } from "@/lib/subjects";
import type { CatalogEntryOut, EditionOut } from "@/lib/types";

const NO_FILTERS: MapFilters = { query: "", hiddenTypologies: new Set(), countries: new Set() };
const NO_CATALOG: CatalogEntryOut[] = [];

type MapError = "noEditions" | "editionsFailed" | "catalogFailed";

/** The newest Latin editio typica, else the newest edition. */
export function defaultEdition(editions: EditionOut[]): string | null {
  const shelf = sortForShelf(editions);
  return (shelf.find(isOriginal) ?? shelf[0])?.edition_id ?? null;
}

/** The map of an edition's eulogies: the sidebar's choices narrow the map and the list together. */
export default function MapPage({ initialEdition }: { initialEdition: string | null }) {
  const router = useRouter();
  const t = useTranslations("Map");
  const locale = useLocale();
  const [editions, setEditions] = useState<EditionOut[]>([]);
  const [edition, setEdition] = useState<string | null>(null);
  const [catalog, setCatalog] = useState(NO_CATALOG);
  const [filters, setFilters] = useState<MapFilters>(NO_FILTERS);
  // The eulogies of a cluster the map could not split, listed in the sidebar.
  const [place, setPlace] = useState<string[] | null>(null);
  // `n` counts the picks, so picking the same eulogy again reveals it again.
  const [selected, setSelected] = useState<{ id: string; n: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MapError | null>(null);
  // Retry refetches whichever failed: the editions (nothing loaded yet) or the catalog.
  const [editionsTry, setEditionsTry] = useState(0);
  const [catalogTry, setCatalogTry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getEditions()
      .then((all) => {
        if (cancelled) return;
        // An edition registered without texts has no catalog to map.
        const eds = all.filter((e) => e.availability.status !== "unavailable");
        setEditions(eds);
        if (eds.length === 0) {
          setError("noEditions");
          setLoading(false);
          return;
        }
        setEdition(eds.some((e) => e.edition_id === initialEdition) ? initialEdition : defaultEdition(eds));
      })
      .catch((err) => {
        console.error(`map: editions: ${describeError(err)}`);
        if (!cancelled) {
          setError("editionsFailed");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // Once per page (and per retry): router.replace hands a new initialEdition after the
    // reader picks an edition, which is already chosen and must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionsTry]);

  useEffect(() => {
    if (!edition) return;
    const e = editions.find((x) => x.edition_id === edition);
    if (!e) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await getCatalog(edition, editionLang(e));
        if (!cancelled) setCatalog(loaded);
      } catch (err) {
        console.error(`map: catalog ${edition}: ${describeError(err)}`);
        if (!cancelled) {
          setCatalog(NO_CATALOG);
          setError("catalogFailed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [edition, editions, catalogTry]);

  const chooseEdition = (id: string) => {
    setEdition(id);
    // The old edition's markers would link into the new one while its catalog loads.
    setCatalog(NO_CATALOG);
    setFilters(NO_FILTERS);
    setPlace(null);
    setSelected(null);
    router.replace(`/map?edition=${encodeURIComponent(id)}`, { scroll: false });
  };

  const changeFilters = (f: MapFilters) => {
    setFilters(f);
    setPlace(null);
  };

  // Subjects in the interface language (the reader's, else English, else Latin); the catalog's own if the registry lacks the ID.
  const mapped = useMemo(() => {
    const registry = getSnapshot();
    return mapEntries(catalog, getPlaces(), (id, own) => subjectFor(registry[id]?.subject, locale, own));
  }, [catalog, locale]);
  // The map redraws thousands of markers: it follows the typing at its own pace.
  const deferred = useDeferredValue(filters);
  const filtered = useMemo(() => filterEntries(mapped.entries, deferred), [mapped, deferred]);
  const facets = useMemo(() => facetCounts(mapped.entries, filters), [mapped, filters]);
  const atPlace = useMemo(() => {
    if (!place) return null;
    const ids = new Set(place);
    return filtered.filter((e) => ids.has(e.id));
  }, [filtered, place]);
  const onPlace = useCallback((ids: string[]) => setPlace(ids), []);
  const onSelect = useCallback((id: string) => setSelected((s) => ({ id, n: (s?.n ?? 0) + 1 })), []);

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-[32rem] flex-col md:flex-row">
      {/* One sidebar: a "Filters" disclosure above the map on narrow screens, a fixed column beside it from md up. */}
      <details
        open
        className="shrink-0 border-b border-slate-200 md:w-80 md:overflow-y-auto md:border-r md:border-b-0 dark:border-slate-800"
      >
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium md:hidden">{t("filters")}</summary>
        <div className="max-h-[50dvh] overflow-y-auto md:max-h-none">
          <MapSidebar
            editions={editions}
            edition={edition ?? ""}
            onEdition={chooseEdition}
            filters={filters}
            onFilters={changeFilters}
            facets={facets}
            results={atPlace ?? filtered}
            mapped={mapped.entries.length}
            unmapped={mapped.unmapped}
            place={
              atPlace && atPlace.length > 0
                ? { label: [...new Set(atPlace.map((e) => e.label))].join(" / "), count: atPlace.length }
                : null
            }
            onShowAll={() => setPlace(null)}
            selected={selected?.id ?? null}
            onSelect={onSelect}
            status={{ loading, error: error ? t(`error.${error}`) : null }}
            onRetry={() => (editions.length ? setCatalogTry((n) => n + 1) : setEditionsTry((n) => n + 1))}
          />
        </div>
      </details>
      <div className="min-h-0 flex-1">
        {edition && (
          <EulogyMap entries={filtered} edition={edition} selected={selected} onSelect={onSelect} onPlace={onPlace} />
        )}
      </div>
    </div>
  );
}
