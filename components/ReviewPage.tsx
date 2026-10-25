"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { parseChangeset, exportChangeset, opId, type Changeset, type Op, type RealignOp, type RelabelOp, type RenameOp } from "@/lib/changeset";
import { groupByEulogy, relabelConflicts, resolvedTarget } from "@/lib/subject-review";
import {
  decisionsFromChangeset,
  decisionsKey,
  loadDecisionsFor,
  saveDecisions,
  summarize,
  type DecisionMap,
} from "@/lib/decisions";
import type { DecisionRecord } from "@/lib/changeset";
import type { Locale } from "@/lib/types";
import OperationCard from "@/components/OperationCard";
import ReviewSummary from "@/components/ReviewSummary";

// Cards render a page at a time: a gazetteer queue holds ~1,900 places.
const PAGE_SIZE = 50;

// A realign op is filtered by its action (split, rekey, …), other ops by their op.
function opKind(op: Op): string {
  return op.op === "realign" ? `realign:${(op as RealignOp).action}` : op.op;
}

// Any truthy `prefilled` ("jev" on a place, "rule"/"jev" on a rename or person op).
function isPrefilled(op: Op): boolean {
  return "prefilled" in op && !!op.prefilled;
}

function stripExt(name: string): string {
  return name.replace(/\.json$/i, "");
}

/** The "ID contains" filter: a card's own ID, or a eulogy it occurs in (a place card's ID is its Latin phrase). */
function matchesId(op: Op, text: string): boolean {
  const occurrences = "occurrences" in op && Array.isArray(op.occurrences) ? (op.occurrences as string[]) : [];
  return opId(op).includes(text) || occurrences.some((id) => id.includes(text));
}

export default function ReviewPage() {
  const t = useTranslations("Review");
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
  const [prefilledOnly, setPrefilledOnly] = useState(false);
  const [idFilter, setIdFilter] = useState("");
  // Paging restarts when the change-set or a filter changes (derived, not reset in an effect).
  const pageKey = `${name}|${classFilter}|${confidenceFilter}|${opFilter}|${undecidedOnly}|${prefilledOnly}|${idFilter}`;
  const [paging, setPaging] = useState({ key: pageKey, shown: PAGE_SIZE });
  const shown = paging.key === pageKey ? paging.shown : PAGE_SIZE;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/changesets");
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
      const res = await fetch(`/api/changesets/${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error(t("fetchFailed", { filename }));
      const text = await res.text();
      const parsed = parseChangeset(text);
      setCs(parsed);
      setName(stripExt(filename));
      // Seed from decisions carried in the file (e.g. a prefilled audit), then let
      // localStorage (the curator's own in-progress work) override for resume.
      setDecisions({ ...decisionsFromChangeset(parsed), ...loadDecisionsFor(parsed) });
      setPrefilledOnly(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadFailed"));
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
      // Seed from decisions carried in the file (e.g. a prefilled audit), then let
      // localStorage (the curator's own in-progress work) override for resume.
      setDecisions({ ...decisionsFromChangeset(parsed), ...loadDecisionsFor(parsed) });
      setPrefilledOnly(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("parseFailed"));
      setCs(null);
    } finally {
      setLoading(false);
    }
  };

  const onDecide = (id: string, d: DecisionRecord) => {
    if (!cs) return;
    const op = cs.operations.find((o) => opId(o) === id);
    const target = d.decision === "accept" && op ? resolvedTarget(op) : null;
    const next = { ...decisions, [id]: target ? { ...d, target } : d };
    setDecisions(next);
    saveDecisions(decisionsKey(cs), next);
  };

  // Pre-filled cards (Jev's pick, or a rule's) carry a truthy `prefilled`; the box appears only when some do.
  const hasPrefilled = useMemo(() => !!cs && cs.operations.some(isPrefilled), [cs]);

  const filteredOps = useMemo(() => {
    if (!cs) return [];
    return cs.operations.filter((op) => {
      if (classFilter && op.class !== classFilter) return false;
      if (confidenceFilter && op.confidence !== confidenceFilter) return false;
      if (opFilter && opKind(op) !== opFilter) return false;
      if (idFilter && !matchesId(op, idFilter.trim())) return false;
      if (undecidedOnly && decisions[opId(op)]) return false;
      if (prefilledOnly && hasPrefilled && !isPrefilled(op)) return false;
      return true;
    });
  }, [cs, classFilter, confidenceFilter, opFilter, undecidedOnly, prefilledOnly, hasPrefilled, idFilter, decisions]);

  // A change-set with rename candidates or relabels (crmedr's subject month) shows a eulogy's cards together.
  const grouped = useMemo(
    () => !!cs && cs.operations.some((op) => op.op === "relabel" || (op.op === "rename" && !!(op as RenameOp).candidates?.length)),
    [cs]
  );
  // Paging counts cards; a group may be cut by "show more".
  const pageGroups = useMemo(() => {
    if (!grouped) return [];
    let left = shown;
    const out: ReturnType<typeof groupByEulogy> = [];
    for (const group of groupByEulogy(filteredOps)) {
      if (left <= 0) break;
      out.push({ eulogy: group.eulogy, ops: group.ops.slice(0, left) });
      left -= group.ops.length;
    }
    return out;
  }, [grouped, filteredOps, shown]);

  // Bulk accept: every undecided add_place op the filters select (all pages), once a confidence is chosen.
  const bulkTargets = useMemo(
    () =>
      opFilter === "add_place" && confidenceFilter
        ? filteredOps.filter((op) => op.op === "add_place" && !decisions[opId(op)])
        : [],
    [filteredOps, opFilter, confidenceFilter, decisions]
  );
  // The batch a confirmation was asked for: another change-set or filter is another batch, asked afresh.
  const bulkBatch = bulkTargets.map(opId).join("\n");
  const [bulkAskedFor, setBulkAskedFor] = useState<string | null>(null);
  const bulkAsk = bulkAskedFor === bulkBatch;
  const setBulkAsk = (ask: boolean) => setBulkAskedFor(ask ? bulkBatch : null);
  const bulkAccept = () => {
    if (!cs) return;
    const next = { ...decisions };
    for (const op of bulkTargets) next[opId(op)] = { decision: "accept" };
    setDecisions(next);
    saveDecisions(decisionsKey(cs), next);
    setBulkAsk(false);
  };

  const classOptions = useMemo(
    () => Array.from(new Set((cs?.operations ?? []).map((o) => o.class).filter(Boolean))) as string[],
    [cs]
  );
  const confidenceOptions = useMemo(
    () => Array.from(new Set((cs?.operations ?? []).map((o) => o.confidence).filter(Boolean))) as string[],
    [cs]
  );
  const opOptions = useMemo(() => Array.from(new Set((cs?.operations ?? []).map(opKind))), [cs]);

  const summary = useMemo(() => (cs ? summarize(cs, decisions) : { accepted: 0, rejected: 0, edited: 0, undecided: 0 }), [cs, decisions]);

  // A subject accepted while its ID changed since: crmedr's apply would reject it, so the export waits.
  const conflicts = useMemo(() => (cs ? relabelConflicts(cs.operations, decisions) : []), [cs, decisions]);

  const onExport = () => {
    if (!cs || conflicts.length > 0) return;
    const out = exportChangeset(cs, decisions);
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "changeset"}.decided.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // The subject follows the ID: a relabel reads its eulogy's rename and that rename's current decision.
  const subjectLinks = useMemo(() => {
    const renames = new Map<string, RenameOp>();
    const relabelled = new Set<string>();
    for (const op of cs?.operations ?? []) {
      if (op.op === "rename" && !renames.has((op as RenameOp).id)) renames.set((op as RenameOp).id, op as RenameOp);
      if (op.op === "relabel") relabelled.add((op as RelabelOp).id);
    }
    return { renames, relabelled };
  }, [cs]);

  const renderCard = (op: Op) => {
    const rename = op.op === "relabel" ? subjectLinks.renames.get((op as RelabelOp).id) : undefined;
    return (
      <OperationCard
        key={opId(op)}
        op={op}
        rename={rename}
        renameDecision={rename ? decisions[opId(rename)] : undefined}
        hasRelabel={op.op === "rename" && subjectLinks.relabelled.has((op as RenameOp).id)}
        decision={decisions[opId(op)]}
        onDecide={onDecide}
        locale={locale}
        baseEdition={cs?.base.edition ?? ""}
      />
    );
  };

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        {t("intro")}
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          {t("bundled")}
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            value={selectedBundled}
            onChange={(e) => onSelectBundled(e.target.value)}
          >
            <option value="">{t("select")}</option>
            {bundled.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          {t("upload")}
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
          {t("locale")}
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

      {loading && <p className="mt-4 text-slate-500 dark:text-slate-400">{t("loading")}</p>}

      {cs && !loading && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              {t("filters.class")}
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              {t("filters.confidence")}
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                {confidenceOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              {t("filters.op")}
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                value={opFilter}
                onChange={(e) => setOpFilter(e.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                {opOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              {t("filters.idContains")}
              <input
                className="w-40 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                value={idFilter}
                onChange={(e) => setIdFilter(e.target.value)}
                placeholder="mr:0101"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={undecidedOnly}
                onChange={(e) => setUndecidedOnly(e.target.checked)}
              />
              {t("filters.undecidedOnly")}
            </label>
            {hasPrefilled && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefilledOnly}
                  onChange={(e) => setPrefilledOnly(e.target.checked)}
                />
                {t("filters.prefilledOnly")}
              </label>
            )}
          </div>

          <div className="mt-4">
            <ReviewSummary summary={summary} onExport={onExport} blocked={conflicts.length} />
          </div>

          <div className="mt-4">
            {bulkTargets.length > 0 && (
              <div className="mb-2 flex items-center gap-2 text-sm">
                {!bulkAsk ? (
                  <button
                    type="button"
                    className="rounded bg-green-700 px-2 py-1 text-xs font-medium text-white hover:bg-green-800"
                    onClick={() => setBulkAsk(true)}
                  >
                    {t("bulkAccept", { count: bulkTargets.length })}
                  </button>
                ) : (
                  <>
                    <span>{t("bulkConfirm", { count: bulkTargets.length })}</span>
                    <button
                      type="button"
                      className="rounded bg-green-700 px-2 py-1 text-xs font-medium text-white hover:bg-green-800"
                      onClick={bulkAccept}
                    >
                      {t("confirm")}
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-400 px-2 py-1 text-xs font-medium text-white hover:bg-slate-500"
                      onClick={() => setBulkAsk(false)}
                    >
                      {t("actions.cancel")}
                    </button>
                  </>
                )}
              </div>
            )}
            {filteredOps.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400">{t("noMatch")}</p>
            )}
            {grouped
              ? pageGroups.map((group, i) => (
                  <section key={group.eulogy ?? `single-${i}`} className={group.eulogy ? "mb-3 rounded border border-slate-300 p-2 dark:border-slate-600" : undefined}>
                    {group.eulogy && <h2 className="mb-2 font-mono text-xs text-slate-500 dark:text-slate-400">{t("eulogyGroup", { eulogy: group.eulogy })}</h2>}
                    {group.ops.map(renderCard)}
                  </section>
                ))
              : filteredOps.slice(0, shown).map(renderCard)}
            {filteredOps.length > shown && (
              <button
                type="button"
                className="mt-2 rounded bg-slate-600 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
                onClick={() => setPaging({ key: pageKey, shown: shown + PAGE_SIZE })}
              >
                {t("showMore", { count: filteredOps.length - shown })}
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
