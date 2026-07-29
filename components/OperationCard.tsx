"use client";

import { useState } from "react";
import EulogyView from "@/components/EulogyView";
import {
  isAdjudicable,
  opId,
  type Op,
  type RenameOp,
  type DeleteOp,
  type MergeOp,
  type DecisionRecord,
} from "@/lib/changeset";
import type { Locale } from "@/lib/types";

// We align to the 2004 editio typica, so a merge winner's text is shown from 2004 when
// present; only a winner with no 2004 placement (i.e. both IDs deprecated) shows an older
// edition for the comparison.
const CURRENT_EDITION = "martyrologium_romanum_2004";

interface Props {
  op: Op;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
  locale: Locale;
  baseEdition: string;
}

export default function OperationCard({ op, decision, onDecide, locale, baseEdition }: Props) {
  const [editing, setEditing] = useState(false);
  const ed = decision?.edited;
  // rename/delete edit inputs, seeded from a saved edit (resume) then the proposal
  const [newIdInput, setNewIdInput] = useState(
    ed?.new_id ?? (op.op === "rename" ? (op as RenameOp).new_id : "")
  );
  const [subjectLaInput, setSubjectLaInput] = useState(
    ed?.subject_la ?? (op.op === "rename" ? ((op as RenameOp).subject_la ?? "") : "")
  );
  const [reasonInput, setReasonInput] = useState(
    ed?.reason ?? (op.op === "delete" ? ((op as DeleteOp).reason ?? "") : "")
  );
  // merge: which of the involved ids is the winner (reversible). Seeded from a saved
  // edit (resume) then the proposal's winner.
  const mergeIds =
    op.op === "merge" ? Array.from(new Set([...(op as MergeOp).ids, (op as MergeOp).winner])) : [];
  const [selectedWinner, setSelectedWinner] = useState(
    ed?.winner ?? (op.op === "merge" ? (op as MergeOp).winner : "")
  );

  const adjudicable = isAdjudicable(op);
  const id_ = opId(op);
  const decide = (d: DecisionRecord) => onDecide(id_, d);

  // Accepting a merge whose winner was flipped from the proposal records it as an edit.
  const acceptMerge = () =>
    decide(
      selectedWinner === (op as MergeOp).winner
        ? { decision: "accept" }
        : { decision: "edit", edited: { winner: selectedWinner } }
    );

  const decisionClass =
    decision?.decision === "accept"
      ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/30"
      : decision?.decision === "reject"
        ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30"
        : decision?.decision === "edit"
          ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-slate-200 dark:border-slate-800";

  const mergeLosers = mergeIds.filter((x) => x !== selectedWinner);

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

      {/* A merge shows every involved eulogy side by side, each with a radio to pick the
          winner — the loser/winner contract is reversible. Non-merge ops show one eulogy. */}
      {op.op === "merge" ? (
        <div className="mb-2 grid gap-2 md:grid-cols-2">
          {mergeIds.map((mid) => {
            const isWinner = mid === selectedWinner;
            return (
              <div key={mid}>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium">
                  <input
                    type="radio"
                    name={`winner-${id_}`}
                    checked={isWinner}
                    onChange={() => setSelectedWinner(mid)}
                  />
                  {isWinner ? "Winner — kept" : "Make winner"}
                </label>
                <EulogyView
                  id={mid}
                  baseEdition={baseEdition}
                  locale={locale}
                  tone={isWinner ? "winner" : "loser"}
                  preferEdition={isWinner ? CURRENT_EDITION : undefined}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-2">
          <EulogyView id={(op as { id?: string }).id ?? null} baseEdition={baseEdition} locale={locale} />
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
            Merge <span className="font-mono text-xs">{mergeLosers.join(", ")}</span> → winner{" "}
            <span className="font-mono text-xs">{selectedWinner}</span>
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
            onClick={() => (op.op === "merge" ? acceptMerge() : decide({ decision: "accept" }))}
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
          {op.op !== "merge" && (
            <button
              type="button"
              className="rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )}
        </div>
      )}

      {adjudicable && editing && op.op !== "merge" && (
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
