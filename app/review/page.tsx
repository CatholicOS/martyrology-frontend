"use client";

import { useEffect, useMemo, useState } from "react";
import { parseChangeset, exportChangeset, opId, type Changeset } from "@/lib/changeset";
import { decisionsKey, loadDecisions, saveDecisions, summarize, type DecisionMap } from "@/lib/decisions";
import type { DecisionRecord } from "@/lib/changeset";
import type { Locale } from "@/lib/types";
import OperationCard from "@/components/OperationCard";
import ReviewSummary from "@/components/ReviewSummary";

function stripExt(name: string): string {
  return name.replace(/\.json$/i, "");
}

export default function ReviewPage() {
  const [bundled, setBundled] = useState<string[]>([]);
  const [selectedBundled, setSelectedBundled] = useState("");
  const [cs, setCs] = useState<Changeset | null>(null);
  const [name, setName] = useState("");
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [locale, setLocale] = useState<Locale>("la");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [classFilter, setClassFilter] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState("");
  const [opFilter, setOpFilter] = useState("");
  const [undecidedOnly, setUndecidedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/changesets/index.json");
        if (!res.ok) return;
        const data = (await res.json()) as { changesets: string[] };
        if (!cancelled) setBundled(data.changesets ?? []);
      } catch {
        // no bundled index available — file upload still works
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadBundled = async (filename: string) => {
    if (!filename) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/changesets/${filename}`);
      if (!res.ok) throw new Error(`Failed to fetch ${filename}`);
      const text = await res.text();
      const parsed = parseChangeset(text);
      setCs(parsed);
      setName(stripExt(filename));
      setDecisions(loadDecisions(decisionsKey(parsed)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load change-set");
      setCs(null);
    } finally {
      setLoading(false);
    }
  };

  const onSelectBundled = (filename: string) => {
    setSelectedBundled(filename);
    void loadBundled(filename);
  };

  const onFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseChangeset(text);
      setCs(parsed);
      setName(stripExt(file.name));
      setSelectedBundled("");
      setDecisions(loadDecisions(decisionsKey(parsed)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse change-set");
      setCs(null);
    } finally {
      setLoading(false);
    }
  };

  const onDecide = (id: string, d: DecisionRecord) => {
    if (!cs) return;
    const next = { ...decisions, [id]: d };
    setDecisions(next);
    saveDecisions(decisionsKey(cs), next);
  };

  const filteredOps = useMemo(() => {
    if (!cs) return [];
    return cs.operations.filter((op) => {
      if (classFilter && op.class !== classFilter) return false;
      if (confidenceFilter && op.confidence !== confidenceFilter) return false;
      if (opFilter && op.op !== opFilter) return false;
      if (undecidedOnly && decisions[opId(op)]) return false;
      return true;
    });
  }, [cs, classFilter, confidenceFilter, opFilter, undecidedOnly, decisions]);

  const classOptions = useMemo(
    () => Array.from(new Set((cs?.operations ?? []).map((o) => o.class).filter(Boolean))) as string[],
    [cs]
  );
  const confidenceOptions = useMemo(
    () => Array.from(new Set((cs?.operations ?? []).map((o) => o.confidence).filter(Boolean))) as string[],
    [cs]
  );
  const opOptions = useMemo(() => Array.from(new Set((cs?.operations ?? []).map((o) => o.op))), [cs]);

  const summary = useMemo(() => (cs ? summarize(cs, decisions) : { accepted: 0, rejected: 0, edited: 0, undecided: 0 }), [cs, decisions]);

  const onExport = () => {
    if (!cs) return;
    const out = exportChangeset(cs, decisions);
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "changeset"}.decided.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">Review change-set</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Adjudicate proposed operations against the live eulogy text. Decisions persist locally and export as a
        decided change-set.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          Bundled change-set
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            value={selectedBundled}
            onChange={(e) => onSelectBundled(e.target.value)}
          >
            <option value="">— select —</option>
            {bundled.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Or upload a file
          <input
            type="file"
            accept="application/json"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFileUpload(file);
            }}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Locale
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            <option value="la">la</option>
            <option value="it">it</option>
            <option value="en">en</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loading && <p className="mt-4 text-slate-500 dark:text-slate-400">Loading…</p>}

      {cs && !loading && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              Class
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">All</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Confidence
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
              >
                <option value="">All</option>
                {confidenceOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Op
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                value={opFilter}
                onChange={(e) => setOpFilter(e.target.value)}
              >
                <option value="">All</option>
                {opOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={undecidedOnly}
                onChange={(e) => setUndecidedOnly(e.target.checked)}
              />
              Undecided only
            </label>
          </div>

          <div className="mt-4">
            <ReviewSummary summary={summary} onExport={onExport} />
          </div>

          <div className="mt-4">
            {filteredOps.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400">No operations match the current filters.</p>
            )}
            {filteredOps.map((op) => (
              <OperationCard
                key={opId(op)}
                op={op}
                decision={decisions[opId(op)]}
                onDecide={onDecide}
                locale={locale}
                baseEdition={cs.base.edition}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
