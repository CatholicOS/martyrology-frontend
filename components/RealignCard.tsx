"use client";

import { useState } from "react";
import EulogyView from "@/components/EulogyView";
import { decisionClass as cardClass } from "@/components/decisionClass";
import { opId, type DecisionRecord, type EditedFields, type RealignAction, type RealignOp, type SplitPart } from "@/lib/changeset";
import { currentTargets, describeRealign, splitText } from "@/lib/realign";
import { getSnapshot } from "@/lib/snapshot";
import type { Locale } from "@/lib/types";

const CURRENT_EDITION = "martyrologium_romanum_2004";
const ACTIONS: RealignAction[] = ["rename", "rekey", "split", "merge", "link", "note", "rubric"];

interface Props {
  op: RealignOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
  locale: Locale;
  baseEdition: string;
}

const input = "flex-1 rounded border border-slate-300 px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900";

/** The registry's subject and status for an ID, or "new" for one the op would coin. */
function IdTag({ id }: { id?: string }) {
  if (!id) return null;
  const e = getSnapshot()[id];
  const status = !e ? "new" : e.deprecated ? "deprecated" : "current";
  const tone =
    status === "current"
      ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200"
      : status === "deprecated"
        ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
        : "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200";
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1">
      <span className="font-mono text-xs">{id}</span>
      <span className={`rounded px-1 text-[10px] uppercase ${tone}`}>{status}</span>
      {e?.subject.la && <span className="text-xs text-slate-500 dark:text-slate-400">{e.subject.la}</span>}
    </span>
  );
}

/** A run-in text cut at its split points, each part labelled with the ID it takes. */
function SplitView({ text, firstId, parts }: { text: string; firstId: string; parts: SplitPart[] }) {
  const { segments, missing } = splitText(text, firstId, parts);
  return (
    <div className="flex flex-col gap-1">
      {segments.map((s, i) => (
        <div key={i} className="rounded border-l-4 border-violet-400 bg-white/60 py-1 pl-2 dark:bg-slate-900/60">
          <IdTag id={s.id} />
          <p className="mt-0.5 font-serif">{s.text}</p>
        </div>
      ))}
      {missing.map((p, i) => (
        <p key={`m${i}`} className="text-xs text-red-700 dark:text-red-300">
          split_at not found in the text: “{p.split_at}” ({p.id})
        </p>
      ))}
    </div>
  );
}

export default function RealignCard({ op, decision, onDecide, locale, baseEdition }: Props) {
  const ed: EditedFields = decision?.edited ?? {};
  const [editing, setEditing] = useState(false);
  const [show2004, setShow2004] = useState(false);
  const [action, setAction] = useState<RealignAction>(ed.action ?? op.action);
  const [newId, setNewId] = useState(ed.new_id ?? op.new_id ?? "");
  const [subjectLa, setSubjectLa] = useState(ed.subject_la ?? op.subject_la ?? "");
  const [link, setLink] = useState(ed.same_eulogy_with ?? op.same_eulogy_with ?? "");
  const [firstId, setFirstId] = useState(ed.first_id ?? op.first_id ?? op.id);
  const [parts, setParts] = useState<SplitPart[]>(ed.parts ?? op.parts ?? []);
  const [note, setNote] = useState(ed.note ?? "");

  const id_ = opId(op);
  const decide = (d: DecisionRecord) => onDecide(id_, d);
  // What the card shows: the proposal, or the curator's saved edit of it.
  const shown: RealignOp = {
    ...op,
    ...(decision?.decision === "edit" ? ed : {}),
    action: (decision?.decision === "edit" && ed.action) || op.action,
  };
  const texts = op.texts?.[op.id] ?? {};
  const own = texts[op.edition];
  const others = Object.entries(texts).filter(([e]) => e !== op.edition);
  const isCurrent = (x: string) => getSnapshot()[x]?.deprecated === false;
  const targets = currentTargets(shown, isCurrent);

  const setPart = (i: number, patch: Partial<SplitPart>) =>
    setParts(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const saveEdit = () => {
    const edited: EditedFields = { action };
    if (action === "rename" || action === "rekey" || action === "merge") {
      edited.new_id = newId;
      if (subjectLa) edited.subject_la = subjectLa;
    }
    if (link) edited.same_eulogy_with = link;
    if (action === "split") {
      edited.first_id = firstId;
      edited.parts = parts.filter((p) => p.split_at && p.id);
    }
    if (note) edited.note = note;
    decide({ decision: "edit", edited });
    setEditing(false);
  };

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${cardClass(decision)}`} data-testid={`op-card-${id_}`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {shown.action} · {op.edition} · {op.id}
        </span>
        <span className="flex gap-1 text-xs">
          {op.class && <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{op.class}</span>}
          {op.confidence && (
            <span
              className={`rounded px-2 py-0.5 ${op.confidence === "low" ? "bg-amber-100 dark:bg-amber-950" : "bg-slate-100 dark:bg-slate-800"}`}
            >
              {op.confidence}
            </span>
          )}
          {decision && (
            <span className="rounded bg-slate-200 px-2 py-0.5 font-medium dark:bg-slate-800">{decision.decision}</span>
          )}
        </span>
      </div>

      <p className="mb-2 font-medium">{describeRealign(shown)}</p>

      <div className="mb-2 rounded bg-slate-50 p-2 dark:bg-slate-900/40">
        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {op.edition} · <IdTag id={op.id} />
        </p>
        {own === undefined ? (
          <p className="text-xs italic text-slate-500">No {op.edition} text under this key.</p>
        ) : shown.action === "split" ? (
          <SplitView text={own} firstId={shown.first_id ?? op.id} parts={shown.parts ?? []} />
        ) : (
          <p className="font-serif">{own}</p>
        )}
        {others.map(([e, t]) => (
          <details key={e} className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-400">
              {e} text under the same key
            </summary>
            <p className="mt-1 font-serif text-slate-700 dark:text-slate-300">{t}</p>
          </details>
        ))}
      </div>

      <div className="mb-2 flex flex-col gap-1">
        {(shown.action === "rename" || shown.action === "rekey" || shown.action === "merge") && (
          <p>
            → <IdTag id={shown.new_id} />
            {shown.subject_la && shown.target === "new" && (
              <span className="ml-1 text-xs text-slate-500">({shown.subject_la})</span>
            )}
          </p>
        )}
        {shown.same_eulogy_with && (
          <p>
            ⇄ same_eulogy <IdTag id={shown.same_eulogy_with} />
          </p>
        )}
        {op.explanation && <p className="text-slate-700 dark:text-slate-300">{op.explanation}</p>}
        {decision?.edited?.note && <p className="text-xs italic">Curator note: {decision.edited.note}</p>}
      </div>

      {targets.length > 0 && (
        <div className="mb-2">
          <button
            type="button"
            className="text-xs text-sky-700 underline dark:text-sky-300"
            onClick={() => setShow2004(!show2004)}
          >
            {show2004 ? "Hide" : "Show"} the 2004 text of {targets.join(", ")}
          </button>
          {show2004 && (
            <div className="mt-1 grid gap-2 md:grid-cols-2">
              {targets.map((t) => (
                <EulogyView key={t} id={t} baseEdition={baseEdition} locale={locale} preferEdition={CURRENT_EDITION} />
              ))}
            </div>
          )}
        </div>
      )}

      {!editing ? (
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
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs">
            action
            <select className={input} value={action} onChange={(e) => setAction(e.target.value as RealignAction)}>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {(action === "rename" || action === "rekey" || action === "merge") && (
            <>
              <label className="flex items-center gap-2 text-xs">
                new_id
                <input className={input} value={newId} onChange={(e) => setNewId(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-xs">
                subject_la
                <input className={input} value={subjectLa} onChange={(e) => setSubjectLa(e.target.value)} />
              </label>
            </>
          )}
          {action === "split" && (
            <>
              <label className="flex items-center gap-2 text-xs">
                first part
                <input className={input} value={firstId} onChange={(e) => setFirstId(e.target.value)} />
              </label>
              {parts.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                  <span>part {i + 2}</span>
                  <input
                    aria-label={`split_at ${i + 2}`}
                    className={input}
                    value={p.split_at}
                    onChange={(e) => setPart(i, { split_at: e.target.value })}
                  />
                  <input
                    aria-label={`id ${i + 2}`}
                    className={input}
                    value={p.id}
                    onChange={(e) => setPart(i, { id: e.target.value })}
                  />
                  <button
                    type="button"
                    className="text-red-700 dark:text-red-300"
                    onClick={() => setParts(parts.filter((_, j) => j !== i))}
                  >
                    remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="self-start text-xs text-sky-700 underline dark:text-sky-300"
                onClick={() => setParts([...parts, { split_at: "", id: "" }])}
              >
                add a part
              </button>
            </>
          )}
          <label className="flex items-center gap-2 text-xs">
            same_eulogy
            <input className={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="mr:MMDD-…" />
          </label>
          <label className="flex items-center gap-2 text-xs">
            note
            <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="curator note" />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
              onClick={saveEdit}
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
