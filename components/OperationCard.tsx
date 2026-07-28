"use client";

import { useEffect, useState } from "react";
import { getElogium, ApiError } from "@/lib/api";
import {
  isAdjudicable,
  opId,
  type Op,
  type RenameOp,
  type DeleteOp,
  type MergeOp,
  type DecisionRecord,
} from "@/lib/changeset";
import type { EulogyOut, Locale } from "@/lib/types";

interface Props {
  op: Op;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
  locale: Locale;
  baseEdition: string;
}

function affectedId(op: Op): string | null {
  if (op.op === "rename" || op.op === "delete") return (op as { id?: string }).id ?? null;
  if (op.op === "merge") return (op as { ids: string[] }).ids[0] ?? null;
  return null;
}

function pickEditionText(
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

export default function OperationCard({ op, decision, onDecide, locale, baseEdition }: Props) {
  const [eulogy, setEulogy] = useState<EulogyOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  // Seed edit inputs from a previously-saved edit (resume from localStorage / filter
  // toggle remounts the card) falling back to the original proposal, so re-opening Edit
  // shows the curator's saved correction rather than silently reverting it.
  const ed = decision?.edited;
  const [newIdInput, setNewIdInput] = useState(
    ed?.new_id ?? (op.op === "rename" ? (op as RenameOp).new_id : "")
  );
  const [subjectLaInput, setSubjectLaInput] = useState(
    ed?.subject_la ?? (op.op === "rename" ? ((op as RenameOp).subject_la ?? "") : "")
  );
  const [winnerInput, setWinnerInput] = useState(
    ed?.winner ?? (op.op === "merge" ? (op as MergeOp).winner : "")
  );
  const [reasonInput, setReasonInput] = useState(
    ed?.reason ?? (op.op === "delete" ? ((op as DeleteOp).reason ?? "") : "")
  );

  const id = affectedId(op);
  const adjudicable = isAdjudicable(op);

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

  const id_ = opId(op);
  const decide = (d: DecisionRecord) => onDecide(id_, d);

  const decisionClass =
    decision?.decision === "accept"
      ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/30"
      : decision?.decision === "reject"
        ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30"
        : decision?.decision === "edit"
          ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-slate-200 dark:border-slate-800";

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass}`} data-testid={`op-card-${id_}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {id_}
        </span>
        {decision && (
          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
            {decision.decision}
          </span>
        )}
      </div>

      {loading && <p className="text-slate-500 dark:text-slate-400">Loading eulogy…</p>}
      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
      {eulogy &&
        (() => {
          const { text, editionId, isFallback } = pickEditionText(eulogy, baseEdition);
          return (
            <div className="mb-2 rounded bg-slate-50 p-2 dark:bg-slate-900">
              <p className="font-semibold">{eulogy.subject[locale] ?? eulogy.subject.la ?? eulogy.id}</p>
              {isFallback && editionId && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  no {baseEdition} placement — showing {editionId}
                </p>
              )}
              {!isFallback && editionId && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{editionId}</p>
              )}
              <p className="mt-1">{text ?? "(no text)"}</p>
            </div>
          );
        })()}

      <div className="mb-2">
        {op.op === "rename" && (
          <p>
            <span className="font-mono text-xs">{(op as RenameOp).id}</span> →{" "}
            <span className="font-mono text-xs">{(op as RenameOp).new_id}</span>
          </p>
        )}
        {op.op === "delete" && (
          <p>
            Delete <span className="font-mono text-xs">{(op as DeleteOp).id}</span>
            {(op as DeleteOp).reason ? ` — ${(op as DeleteOp).reason}` : ""}
          </p>
        )}
        {op.op === "merge" && (
          <p>
            Merge <span className="font-mono text-xs">{(op as MergeOp).ids.join(", ")}</span> → winner{" "}
            <span className="font-mono text-xs">{(op as MergeOp).winner}</span>
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {op.class ? `class: ${op.class} · ` : ""}
          {op.confidence ? `confidence: ${op.confidence} · ` : ""}
          {op.reasoning ? `reasoning: ${op.reasoning}` : ""}
        </p>
      </div>

      {!adjudicable && (
        <p className="text-xs italic text-slate-500 dark:text-slate-400">Not adjudicable (op: {op.op})</p>
      )}

      {adjudicable && !editing && (
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
            onClick={() => decide({ decision: "accept" })}
          >
            Accept
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
            onClick={() => decide({ decision: "reject" })}
          >
            Reject
          </button>
          <button
            type="button"
            className="rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        </div>
      )}

      {adjudicable && editing && (
        <div className="flex flex-col gap-2">
          {op.op === "rename" && (
            <>
              <label className="flex items-center gap-2 text-xs">
                new_id
                <input
                  className="flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                  value={newIdInput}
                  onChange={(e) => setNewIdInput(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                subject_la
                <input
                  className="flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                  value={subjectLaInput}
                  onChange={(e) => setSubjectLaInput(e.target.value)}
                />
              </label>
            </>
          )}
          {op.op === "merge" && (
            <label className="flex items-center gap-2 text-xs">
              winner
              <input
                className="flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                value={winnerInput}
                onChange={(e) => setWinnerInput(e.target.value)}
              />
            </label>
          )}
          {op.op === "delete" && (
            <label className="flex items-center gap-2 text-xs">
              reason
              <input
                className="flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
              />
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
              onClick={() => {
                if (op.op === "rename") {
                  decide({ decision: "edit", edited: { new_id: newIdInput, subject_la: subjectLaInput } });
                } else if (op.op === "merge") {
                  decide({ decision: "edit", edited: { winner: winnerInput } });
                } else if (op.op === "delete") {
                  decide({ decision: "edit", edited: { reason: reasonInput } });
                }
                setEditing(false);
              }}
            >
              Save edit
            </button>
            <button
              type="button"
              className="rounded bg-slate-400 px-2 py-1 text-xs font-medium text-white hover:bg-slate-500"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
