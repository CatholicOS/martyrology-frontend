"use client";

import { useEffect, useState } from "react";
import { getElogium, ApiError } from "@/lib/api";
import type { EulogyOut, Locale } from "@/lib/types";

/**
 * Pick the eulogy text to show, preferring the change-set's base edition (so a
 * merge compares like-for-like, e.g. 1749 vs 1749); fall back to any edition that
 * has text, flagged so the curator knows they're not seeing the base edition.
 */
export function pickEditionText(
  eulogy: EulogyOut,
  baseEdition: string
): { text: string | null; editionId: string | null; isFallback: boolean } {
  const base = eulogy.editions[baseEdition];
  if (base?.text) return { text: base.text, editionId: baseEdition, isFallback: false };
  for (const [edId, p] of Object.entries(eulogy.editions)) {
    if (p.text) return { text: p.text, editionId: edId, isFallback: true };
  }
  return { text: null, editionId: null, isFallback: false };
}

interface Props {
  id: string | null;
  baseEdition: string;
  locale: Locale;
  label?: string;
  tone?: "neutral" | "winner" | "loser";
}

/** Fetches and renders one eulogy (subject + edition text) for a canonical id. */
export default function EulogyView({ id, baseEdition, locale, label, tone = "neutral" }: Props) {
  const [eulogy, setEulogy] = useState<EulogyOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getElogium(id);
        if (!cancelled) setEulogy(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? `text unavailable (${err.title})` : "text unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) return null;

  const toneClass =
    tone === "winner"
      ? "border-l-2 border-green-500 bg-green-50/60 dark:bg-green-950/20"
      : tone === "loser"
        ? "border-l-2 border-red-400 bg-red-50/50 dark:bg-red-950/20"
        : "bg-slate-50 dark:bg-slate-900";
  const sel = eulogy ? pickEditionText(eulogy, baseEdition) : null;

  return (
    <div className={`rounded p-2 ${toneClass}`}>
      {label && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
      )}
      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{id}</p>
      {loading && <p className="text-slate-500 dark:text-slate-400">Loading eulogy…</p>}
      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
      {eulogy && sel && (
        <>
          <p className="font-semibold">{eulogy.subject[locale] ?? eulogy.subject.la ?? eulogy.id}</p>
          {sel.isFallback && sel.editionId && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              no {baseEdition} placement — showing {sel.editionId}
            </p>
          )}
          {!sel.isFallback && sel.editionId && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{sel.editionId}</p>
          )}
          <p className="mt-1">{sel.text ?? "(no text)"}</p>
        </>
      )}
    </div>
  );
}
