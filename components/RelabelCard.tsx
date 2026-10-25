"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import EulogyView from "@/components/EulogyView";
import { FlagText } from "@/components/RenameCard";
import { decisionClass, decisionLabel } from "@/components/decisionClass";
import { opId, type DecisionRecord, type RelabelOp, type SubjectLabels } from "@/lib/changeset";
import { relabelChoiceIndex, relabelChoiceRecord, relabelJevRecord } from "@/lib/subject-review";
import type { Locale } from "@/lib/types";

const button = "rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-40";
const input = "flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900";
const chip = "rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800";
// Beside a single eulogy: the Italian 2004, else the 1914 English (as RenameCard).
const ALONGSIDE = ["martyrologium_romanum_2004_it_IT", "martyrologium_romanum_1914_en_unofficial"];
const LANGS = ["la", "en", "it"] as const;

interface Props {
  op: RelabelOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
  locale: Locale;
  baseEdition: string;
}

/** Latin · English · Italian, a dash for a missing language. */
const labelsLine = (l: SubjectLabels) => LANGS.map((k) => l[k] ?? "—").join(" · ");

/**
 * Review card for a eulogy's subjects (crmedr subject identity): the current set, the proposal and
 * the other candidates, Jev's pick. Accept takes the selected set, edit types the three labels,
 * keep leaves the current subjects. A click records the decision; Jev never does.
 */
export default function RelabelCard({ op, decision, onDecide, locale, baseEdition }: Props) {
  const t = useTranslations("Review.relabel");
  const r = useTranslations("Review");
  const uid = opId(op);
  const candidates = op.candidates ?? [];
  const [selected, setSelected] = useState(() => relabelChoiceIndex(op, decision));
  const [editing, setEditing] = useState(false);
  const seed = decision?.edited?.labels ?? op.labels;
  const [fields, setFields] = useState<Record<(typeof LANGS)[number], string>>({
    la: seed.la ?? "",
    en: seed.en ?? "",
    it: seed.it ?? "",
  });
  const jev = op.jev;
  const jevRecord = relabelJevRecord(op);
  const jevWhat =
    jev?.decision === "accept" ? t("proposed") : jev?.decision === "reject" ? t("keepWhat") : jev?.labels ? labelsLine(jev.labels) : "";
  const scores = jev?.scores ?? [];
  const flags = jev?.flags ?? [];
  // A saved edit that is none of the candidates: shown, not replaced by a radio.
  const unmatchedEdit = decision?.decision === "edit" && decision.edited?.labels && relabelChoiceIndex(op, decision) < 0 ? decision.edited.labels : null;

  const decide = (d: DecisionRecord) => {
    const at = relabelChoiceIndex(op, d);
    setSelected(at);
    onDecide(uid, d);
  };

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${uid}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {uid}
        </span>
        <span className="flex items-center gap-2">
          {op.prefilled === "jev" && (
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
              {t("prefilled")}
            </span>
          )}
          {decision && (
            <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">{decisionLabel(r, decision)}</span>
          )}
        </span>
      </div>

      <div className="mb-2">
        <EulogyView id={op.id} baseEdition={baseEdition} locale={locale} alongside={ALONGSIDE} />
      </div>

      <p className="mb-2 text-xs">
        <span className="font-medium">{t("current")}</span>{" "}
        <span className="text-slate-700 dark:text-slate-300">{labelsLine(op.current)}</span>
      </p>

      <ul className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label={t("candidates")}>
        {candidates.map((c, i) => {
          const score = scores[i];
          return (
            <li key={`${c.from_id ?? "current"}-${i}`}>
              <label className="flex items-start gap-2">
                <input type="radio" className="mt-1" name={`relabel-${uid}`} checked={selected === i} onChange={() => setSelected(i)} />
                <span className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-700 dark:text-slate-300">{labelsLine(c.labels)}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {c.from_id === null ? t("currentSet") : t("from", { id: c.from_id })}
                    </span>
                    {typeof score === "number" && <span className={chip}>{r("rename.clarity", { score: score.toFixed(1) })}</span>}
                  </span>
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
      {jev && !jev.decision && flags.length > 0 && <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">{r("rename.doubts")}</p>}
      {flags.length > 0 && (
        <ul className="mb-2 list-disc pl-5 text-xs text-amber-700 dark:text-amber-400">
          {flags.map((f) => (
            <li key={f}>
              <FlagText flag={f} />
            </li>
          ))}
        </ul>
      )}
      {unmatchedEdit && <p className="mb-2 text-xs text-slate-700 dark:text-slate-300">{t("edited", { labels: labelsLine(unmatchedEdit) })}</p>}

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          {jev?.decision && (
            <button
              type="button"
              disabled={!jevRecord}
              className={`${button} bg-indigo-600 hover:bg-indigo-700`}
              onClick={() => {
                if (!jevRecord) return;
                const taken = jevRecord.edited?.labels;
                if (taken) setFields({ la: taken.la ?? "", en: taken.en ?? "", it: taken.it ?? "" });
                decide(jevRecord);
              }}
            >
              {t("take")}
            </button>
          )}
          <button type="button" disabled={selected < 0} className={`${button} bg-green-600 hover:bg-green-700`} onClick={() => onDecide(uid, relabelChoiceRecord(op, selected))}>
            {t("acceptSelected")}
          </button>
          <button type="button" className={`${button} bg-slate-600 hover:bg-slate-700`} onClick={() => setEditing(true)}>
            {r("actions.edit")}
          </button>
          <button type="button" className={`${button} bg-red-600 hover:bg-red-700`} onClick={() => decide({ decision: "reject" })}>
            {t("keep")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {LANGS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-xs">
              <span className="w-14">{t(`lang.${k}`)}</span>
              <input className={input} value={fields[k]} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
            </label>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              className={`${button} bg-amber-600 hover:bg-amber-700`}
              onClick={() => {
                const labels = Object.fromEntries(LANGS.map((k) => [k, fields[k].trim() || null])) as unknown as SubjectLabels;
                decide({ decision: "edit", edited: { labels } });
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
