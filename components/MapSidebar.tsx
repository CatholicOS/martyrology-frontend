"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { natureLabel, sortForShelf, yearAndLanguage } from "@/lib/editions";
import { typologyLabel, type MapEntry, type MapFilters } from "@/lib/map-data";
import type { EditionOut } from "@/lib/types";

interface Props {
  editions: EditionOut[];
  edition: string;
  onEdition: (id: string) => void;
  filters: MapFilters;
  onFilters: (f: MapFilters) => void;
  facets: { typologies: [string, number][]; countries: [string, number][] };
  /** The filtered eulogies, or those at the clicked place when `place` is set. */
  results: MapEntry[];
  mapped: number;
  unmapped: number;
  /** The place whose eulogies the list shows (a single-place cluster was clicked), or null. */
  place: { label: string; count: number } | null;
  onShowAll: () => void;
  selected: string | null;
  onSelect: (id: string) => void;
  status: { loading: boolean; error: string | null };
  onRetry: () => void;
}

// The results list is a way into the map, not the whole catalog: past this, narrow the search.
const MAX_ROWS = 300;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code || "Unknown";
  }
}

const INPUT = "w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900";

function toggle(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** The map's controls and results: edition, search, typology and country filters, and the eulogies shown. */
export default function MapSidebar(p: Props) {
  const tShelf = useTranslations("Bookshelf");
  const [countryQuery, setCountryQuery] = useState("");
  const countries = useMemo(
    () =>
      p.facets.countries
        .map(([code, n]) => ({ code, n, name: countryName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [p.facets.countries],
  );
  const cq = countryQuery.trim().toLowerCase();
  const shownCountries = countries.filter(
    (c) => !cq || c.name.toLowerCase().includes(cq) || p.filters.countries.has(c.code),
  );

  return (
    <aside className="flex flex-col gap-4 p-4 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Edition</span>
        <select className={INPUT} value={p.edition} onChange={(e) => p.onEdition(e.target.value)}>
          {sortForShelf(p.editions).map((e) => (
            <option key={e.edition_id} value={e.edition_id}>
              {yearAndLanguage(tShelf, e)} — {natureLabel(tShelf, e.nature)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Search subject or ID</span>
        <input
          type="search"
          className={INPUT}
          value={p.filters.query}
          placeholder="Sanctus…, mr:0101-…, Rome"
          onChange={(e) => p.onFilters({ ...p.filters, query: e.target.value })}
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-medium">Typology</legend>
        {p.facets.typologies.map(([t, n]) => (
          <label key={t} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!p.filters.hiddenTypologies.has(t)}
              onChange={() => p.onFilters({ ...p.filters, hiddenTypologies: toggle(p.filters.hiddenTypologies, t) })}
            />
            {typologyLabel(t)} ({n})
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-medium">Country</legend>
        <input
          type="search"
          aria-label="Filter countries"
          className={INPUT}
          value={countryQuery}
          placeholder="Filter countries"
          onChange={(e) => setCountryQuery(e.target.value)}
        />
        <div className="max-h-48 overflow-y-auto">
          {shownCountries.map((c) => (
            <label key={c.code} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={p.filters.countries.has(c.code)}
                onChange={() => p.onFilters({ ...p.filters, countries: toggle(p.filters.countries, c.code) })}
              />
              {c.name} ({c.n})
            </label>
          ))}
        </div>
        {p.filters.countries.size > 0 && (
          <button
            type="button"
            className="self-start text-xs text-blue-700 underline dark:text-blue-400"
            onClick={() => p.onFilters({ ...p.filters, countries: new Set() })}
          >
            All countries
          </button>
        )}
      </fieldset>

      {p.status.error ? (
        <p className="text-red-700 dark:text-red-400">
          {p.status.error}{" "}
          <button type="button" className="underline" onClick={p.onRetry}>
            Retry
          </button>
        </p>
      ) : p.status.loading ? (
        <p className="italic text-slate-500 dark:text-slate-400">Loading…</p>
      ) : (
        <>
          <p className="text-slate-600 dark:text-slate-400">
            {p.results.length} shown · {p.mapped} mapped · {p.unmapped} not mapped in this edition
          </p>
          {p.place && (
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                {p.place.label} — {p.place.count} eulogies
              </h2>
              <button
                type="button"
                className="text-xs text-blue-700 underline dark:text-blue-400"
                onClick={p.onShowAll}
              >
                Show all
              </button>
            </div>
          )}
          {p.results.length === 0 ? (
            <p className="italic text-slate-500 dark:text-slate-400">No eulogy matches these filters.</p>
          ) : (
            <ul className="flex flex-col">
              {p.results.slice(0, MAX_ROWS).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    aria-current={p.selected === e.id ? "true" : undefined}
                    className={`w-full rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      p.selected === e.id ? "bg-slate-200 dark:bg-slate-700" : ""
                    }`}
                    onClick={() => p.onSelect(e.id)}
                  >
                    <span className="block">{e.subject}</span>
                    <span className="block font-mono text-xs text-slate-500 dark:text-slate-400">
                      {e.id} · {e.label}
                    </span>
                  </button>
                </li>
              ))}
              {p.results.length > MAX_ROWS && (
                <li className="px-2 py-1 italic text-slate-500 dark:text-slate-400">
                  and {p.results.length - MAX_ROWS} more — narrow the search to list them.
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
