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
}

function affectedId(op: Op): string | null {
  if (op.op === "rename" || op.op === "delete") return (op as { id?: string }).id ?? null;
  if (op.op === "merge") return (op as { ids: string[] }).ids[0] ?? null;
  return null;
}

function firstEditionText(eulogy: EulogyOut): string | null {
  const placements = Object.values(eulogy.editions);
  const withText = placements.find((p) => p.text);
  return withText?.text ?? null;
}

export default function OperationCard({ op, decision, onDecide, locale }: Props) {
  const [eulogy, setEulogy] = useState<EulogyOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newIdInput, setNewIdInput] = useState(op.op === "rename" ? (op as RenameOp).new_id : "");
  const [subjectLaInput, setSubjectLaInput] = useState(
    op.op === "rename" ? ((op as RenameOp).subject_la ?? "") : ""
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
        if (!cancelled) setError(err instanceof ApiError ? "text unavailable" : "text unavailable");
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
      {eulogy && (
        <div className="mb-2 rounded bg-slate-50 p-2 dark:bg-slate-900">
          <p className="font-semibold">{eulogy.subject[locale] ?? eulogy.subject.la ?? eulogy.id}</p>
          <p className="mt-1">{firstEditionText(eulogy) ?? "(no text)"}</p>
        </div>
      )}

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
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
              onClick={() => {
                decide({ decision: "edit", edited: { new_id: newIdInput, subject_la: subjectLaInput } });
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
