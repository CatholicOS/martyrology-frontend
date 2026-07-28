"use client";

import { useEffect, useMemo, useState } from "react";
import { getCatalog, getEditions, ApiError } from "@/lib/api";
import { getSnapshot } from "@/lib/snapshot";
import { buildComparison, type CompareDayGroup } from "@/lib/compare";
import type { EditionOut, Locale } from "@/lib/types";
import CompareControls from "@/components/CompareControls";
import CompareDay from "@/components/CompareDay";

function localeOf(edition: EditionOut | undefined): Locale {
  const l = edition?.locale;
  return l === "it" || l === "en" || l === "la" ? l : "la";
}

export default function ComparePage() {
  const [editions, setEditions] = useState<EditionOut[]>([]);
  const [editionA, setEditionA] = useState("");
  const [editionB, setEditionB] = useState("");
  const [month, setMonth] = useState<string | null>(null);
  const [groups, setGroups] = useState<CompareDayGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const eds = await getEditions();
        if (cancelled) return;
        setEditions(eds);
        const publicDomain = eds.filter((e) => e.availability.status === "public");
        if (publicDomain.length >= 2) {
          setEditionA(publicDomain[0].edition_id);
          setEditionB(publicDomain[1].edition_id);
        } else if (eds.length >= 2) {
          setEditionA(eds[0].edition_id);
          setEditionB(eds[1].edition_id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? "API unreachable — is martyrology-api running on API_BASE?"
              : "Failed to load editions",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editionA || !editionB) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const eA = editions.find((e) => e.edition_id === editionA);
        const eB = editions.find((e) => e.edition_id === editionB);
        const [a, b] = await Promise.all([
          getCatalog(editionA, localeOf(eA)),
          getCatalog(editionB, localeOf(eB)),
        ]);
        if (cancelled) return;
        setGroups(buildComparison(a, b, getSnapshot()));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? "API unreachable — is martyrology-api running on API_BASE?"
              : "Failed to load catalogs",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // editions is intentionally excluded: it only changes once on initial load,
    // and re-running this effect on every editions update would double-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionA, editionB]);

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    if (!month) return groups;
    return groups.filter((g) => g.day.startsWith(month));
  }, [groups, month]);

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">Compare editions</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Eulogies organized by physical day, aligned by canonical ID between two editions.
      </p>

      <div className="mt-6">
        <CompareControls
          editions={editions}
          editionA={editionA}
          editionB={editionB}
          onEditionAChange={setEditionA}
          onEditionBChange={setEditionB}
          month={month}
          onMonthChange={setMonth}
        />
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-400 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loading && !error && <p className="text-slate-500 dark:text-slate-400">Loading…</p>}

      {!loading && !error && groups && filteredGroups.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400">No entries for this selection.</p>
      )}

      {!loading &&
        !error &&
        filteredGroups.map((group) => <CompareDay key={group.day} group={group} />)}
    </main>
  );
}
