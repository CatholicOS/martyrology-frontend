"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { decisionClass, decisionLabel } from "@/components/decisionClass";
import { opId, type DecisionRecord, type MarginCandidate, type PlaceMarginOp } from "@/lib/changeset";
import { classWords, marginDecision, marginRef, proposedRef, scanImageUrl } from "@/lib/notationes";

const button = "rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-40";

interface Props {
  op: PlaceMarginOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
}

function Candidate({ c }: { c: MarginCandidate }) {
  return (
    <span>
      <span className="font-mono text-xs">{c.ref}</span>
      {c.lemma && <span className="font-serif italic"> {c.lemma}</span>}
      <span className="font-serif text-slate-600 dark:text-slate-400"> — {c.words}</span>
    </span>
  );
}

/**
 * Review card for a `place_margin` op (martyrology-api#100): a margin note of the 1630 edition
 * and the note, or the eulogy, it stands beside, with the page image beside the card. The proposal
 * is an accept, another candidate an edit ({note} or {id}).
 */
export default function PlaceMarginCard({ op, decision, onDecide }: Props) {
  const t = useTranslations("Notes");
  const r = useTranslations("Review");
  const m = useTranslations("Review.margin");
  const [selected, setSelected] = useState(marginRef(op, decision));
  const proposed = proposedRef(op);
  const chosen = op.candidates.find((c) => c.ref === selected);
  const uid = opId(op);
  const decide = (d: DecisionRecord) => onDecide(uid, d);
  const proposal = op.candidates.find((c) => c.ref === proposed);

  return (
    <div
      className={`mb-3 grid gap-3 rounded border p-3 text-sm md:grid-cols-2 ${decisionClass(decision)}`}
      data-testid={`op-card-${uid}`}
    >
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {op.op} · {m("scanSummary", { page: op.scan_page })}
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
              <span className="rounded bg-slate-200 px-2 py-0.5 font-medium dark:bg-slate-800">{decisionLabel(r, decision)}</span>
            )}
          </span>
        </div>

        <p className="mb-2 border-l-4 border-slate-400 pl-2 font-serif text-base" lang="la">
          {op.text}
        </p>
        <p className="mb-2 font-medium">{classWords(t, op.class)}</p>
        {op.reasoning && <p className="mb-2 text-slate-700 dark:text-slate-300">{m("reviewer", { text: op.reasoning })}</p>}
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
          {m("proposed")}
          {proposal ? <Candidate c={proposal} /> : proposed || m("nothing")}
        </p>

        <fieldset className="mb-2 flex flex-col gap-1">
          <legend className="text-xs font-medium">{m("beside")}</legend>
          {op.candidates.map((c) => (
            <label key={c.ref} className="flex items-baseline gap-1">
              <input
                type="radio"
                name={`margin-${uid}`}
                checked={selected === c.ref}
                onChange={() => setSelected(c.ref)}
              />
              <span className="text-[10px] uppercase text-slate-500">{c.kind}</span>
              <Candidate c={c} />
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!chosen}
            className={`${button} bg-green-600 hover:bg-green-700`}
            onClick={() => chosen && decide(marginDecision(op, chosen))}
          >
            {chosen && chosen.ref !== proposed ? m("acceptEdited") : m("accept")}
          </button>
          <button type="button" className={`${button} bg-red-600 hover:bg-red-700`} onClick={() => decide({ decision: "reject" })}>
            {m("notMargin")}
          </button>
        </div>
      </div>

      <figure>
        <a href={op.image} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- a remote scan, shown as is */}
          <img className="w-full border" src={scanImageUrl(op.scan_page)} alt={m("scanPage", { page: op.scan_page })} loading="lazy" />
        </a>
        <figcaption className="mt-1 text-xs">
          <a className="text-sky-700 underline dark:text-sky-300" href={op.image} target="_blank" rel="noreferrer">
            {m("scanOnArchive", { page: op.scan_page })}
          </a>
        </figcaption>
      </figure>
    </div>
  );
}
