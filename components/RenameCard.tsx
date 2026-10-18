"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import EulogyView from "@/components/EulogyView";
import { decisionClass, decisionLabel } from "@/components/decisionClass";
import { opId, type DecisionRecord, type RenameOp } from "@/lib/changeset";
import { renameChoiceRecord, renameJevRecord } from "@/lib/subject-review";
import type { Locale } from "@/lib/types";

const button = "rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-40";
const input = "flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900";
const chip = "rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800";
// Beside a single eulogy: the Italian 2004, else the 1914 English (as IdOperationCard).
const ALONGSIDE = ["martyrologium_romanum_2004_it_IT", "martyrologium_romanum_1914_en_unofficial"];

interface Props {
  op: RenameOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
  locale: Locale;
  baseEdition: string;
}

/** A Jev flag as words: "record:places[0]" or "grammar:places[0]:genitive". */
function FlagText({ flag }: { flag: string }) {
  const t = useTranslations("Review.rename");
  if (flag.startsWith("record:")) return <>{t("flag.record", { field: flag.slice("record:".length) })}</>;
  if (flag.startsWith("grammar:")) {
    const rest = flag.slice("grammar:".length);
    const cut = rest.lastIndexOf(":");
    return <>{t("flag.grammar", { field: cut < 0 ? rest : rest.slice(0, cut), choice: cut < 0 ? "" : rest.slice(cut + 1) })}</>;
  }
  return <>{flag}</>;
}

/**
 * Review card for a subject-identity rename with ranked candidates: pick one (the proposal is the
 * default), take Jev's suggestion, or type an ID by hand. A click records the decision; Jev never does.
 */
export default function RenameCard({ op, decision, onDecide, locale, baseEdition }: Props) {
  const t = useTranslations("Review.rename");
  const r = useTranslations("Review");
  const uid = opId(op);
  const candidates = op.candidates ?? [];
  const savedId = decision?.edited?.new_id;
  const [selected, setSelected] = useState(
    savedId && candidates.some((c) => c.new_id === savedId) ? savedId : op.new_id,
  );
  const [editing, setEditing] = useState(false);
  const [newIdInput, setNewIdInput] = useState(decision?.edited?.new_id ?? op.new_id);
  const [subjectLaInput, setSubjectLaInput] = useState(decision?.edited?.subject_la ?? op.subject_la ?? "");
  const jev = op.jev;
  const jevRecord = renameJevRecord(op);
  const jevWhat = jev?.decision === "accept" ? t("keep") : (jev?.new_id ?? "");
  const flags = jev?.flags ?? [];
  const scores = jev?.scores ?? {};

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${uid}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {uid}
        </span>
        {decision && (
          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">{decisionLabel(r, decision)}</span>
        )}
      </div>

      <div className="mb-2">
        <EulogyView id={op.id} baseEdition={baseEdition} locale={locale} alongside={ALONGSIDE} />
      </div>

      <ul className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label={t("candidates")}>
        {candidates.map((c) => {
          const score = scores[c.new_id];
          return (
            <li key={c.new_id}>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  className="mt-1"
                  name={`rename-${uid}`}
                  checked={selected === c.new_id}
                  onChange={() => setSelected(c.new_id)}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="font-mono text-xs">{c.new_id}</span>
                    <span className={chip}>{t(`category.${c.category}`)}</span>
                    {c.weak && <span className={chip}>{t("weak")}</span>}
                    {c.certain === false && <span className={chip}>{t("uncertain")}</span>}
                    {c.basis === "bare-name draft" && <span className={chip}>{t("draft")}</span>}
                    {score !== undefined && <span className={chip}>{t("clarity", { score: score.toFixed(1) })}</span>}
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300" aria-label={t("labels")}>
                    {[c.labels.la, c.labels.en, c.labels.it].map((l) => l ?? "—").join(" · ")}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{c.basis}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {jev?.decision && (
        <p className="mb-2 text-xs text-indigo-700 dark:text-indigo-300">
          {t("suggests", { what: jevWhat, confidence: Math.round((jev.probability ?? 0) * 100) })}
        </p>
      )}
      {jev && !jev.decision && <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">{t("doubts")}</p>}
      {flags.length > 0 && (
        <ul className="mb-2 list-disc pl-5 text-xs text-amber-700 dark:text-amber-400">
          {flags.map((f) => (
            <li key={f}>
              <FlagText flag={f} />
            </li>
          ))}
        </ul>
      )}

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          {jev?.decision && (
            <button
              type="button"
              disabled={!jevRecord}
              className={`${button} bg-indigo-600 hover:bg-indigo-700`}
              onClick={() => {
                if (!jevRecord) return;
                const taken = jevRecord.decision === "edit" ? (jevRecord.edited?.new_id ?? op.new_id) : op.new_id;
                setSelected(taken);
                if (jevRecord.decision === "edit") {
                  setNewIdInput(taken);
                  setSubjectLaInput(jevRecord.edited?.subject_la ?? "");
                }
                onDecide(uid, jevRecord);
              }}
            >
              {t("take")}
            </button>
          )}
          <button type="button" className={`${button} bg-green-600 hover:bg-green-700`} onClick={() => onDecide(uid, renameChoiceRecord(op, selected))}>
            {t("acceptSelected")}
          </button>
          <button type="button" className={`${button} bg-slate-600 hover:bg-slate-700`} onClick={() => setEditing(true)}>
            {r("actions.edit")}
          </button>
          <button type="button" className={`${button} bg-red-600 hover:bg-red-700`} onClick={() => onDecide(uid, { decision: "reject" })}>
            {r("actions.reject")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs">
            new_id
            <input className={input} value={newIdInput} onChange={(e) => setNewIdInput(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-xs">
            subject_la
            <input className={input} value={subjectLaInput} onChange={(e) => setSubjectLaInput(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`${button} bg-amber-600 hover:bg-amber-700`}
              onClick={() => {
                onDecide(uid, { decision: "edit", edited: { new_id: newIdInput, subject_la: subjectLaInput } });
                setEditing(false);
              }}
            >
              {r("actions.saveEdit")}
            </button>
            <button type="button" className={`${button} bg-slate-400 hover:bg-slate-500`} onClick={() => setEditing(false)}>
              {r("actions.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
