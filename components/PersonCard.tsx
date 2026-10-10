"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import EulogyView from "@/components/EulogyView";
import { decisionClass, decisionLabel } from "@/components/decisionClass";
import { opId, type DecisionRecord, type ResolvePersonOp } from "@/lib/changeset";
import type { Locale } from "@/lib/types";

interface Props {
  op: ResolvePersonOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
  locale: Locale;
  baseEdition: string;
}

const ITALIAN_2004 = "martyrologium_romanum_2004_it_IT";

/**
 * Review card for a crmedr `resolve_person` op: pick the Wikidata item of a saint
 * or blessed named in a eulogy, enter another QID, or record that there is none.
 * As for places, an unchanged suggestion (or top candidate) is a plain accept, any
 * change an edit, and "No item" a reject with a reason; crmedr's `apply` checks an
 * entered QID is a human with a saint or blessed status.
 */
export default function PersonCard({ op, decision, onDecide, locale, baseEdition }: Props) {
  const t = useTranslations("Review.person");
  const tr = useTranslations("Review");
  const suggested = op.suggested ?? null;
  const byQid = new Set(op.candidates.map((c) => c.wikidata));
  const defaultQid = suggested?.wikidata ?? op.candidates[0]?.wikidata ?? "";
  const ed = decision?.decision === "edit" ? decision.edited : undefined;
  const seedQid = ed?.wikidata ?? defaultQid;
  const [selected, setSelected] = useState(byQid.has(seedQid) ? seedQid : defaultQid);
  const [otherQid, setOtherQid] = useState(byQid.has(seedQid) ? "" : seedQid);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(decision?.decision === "reject" ? (decision.edited?.reason ?? "") : "");
  const [showEulogy, setShowEulogy] = useState(false);

  const qid = otherQid.trim() || selected;
  // A listed candidate must pass what crmedr's apply checks (its own evidence: human, a saint or
  // blessed status), or apply refuses the whole export; a typed QID is left for apply to check.
  const listed = otherQid.trim() ? null : op.candidates.find((c) => c.wikidata === qid);
  const eligible = !listed || (listed.evidence.includes("human") && listed.evidence.includes("status"));
  const canAccept = /^Q[1-9]\d*$/.test(qid) && eligible;
  const id = opId(op);
  const unchanged = qid === defaultQid;
  const where = op.where === "text" ? t("inText") : t("inFootnote", { n: op.where.footnote });

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${op.id}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {op.eulogy} · {op.day}
          {op.typology ? ` · ${op.typology}` : ""}
        </span>
        {decision && (
          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">{decisionLabel(tr, decision)}</span>
        )}
      </div>

      <p className="text-base font-semibold">
        {op.name}
        {op.n && <span className="ml-2 text-sm font-normal text-slate-600 dark:text-slate-400">{t("ordinal", { n: op.n })}</span>}
      </p>
      <p className="mb-1 text-slate-700 dark:text-slate-300">
        {op.subject} · {where}
      </p>
      {op.companions.length > 0 && (
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">{t("companions", { names: op.companions.join(", ") })}</p>
      )}
      {op.failed.length > 0 && (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">{t("notAutomatic", { reasons: op.failed.join("; ") })}</p>
      )}

      <button type="button" className="mb-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800" onClick={() => setShowEulogy(!showEulogy)}>
        {showEulogy ? t("hideEulogy") : t("showEulogy")}
      </button>
      {showEulogy && (
        <div className="mb-2">
          <EulogyView id={op.eulogy} baseEdition={baseEdition} locale={locale} alongside={ITALIAN_2004} />
        </div>
      )}

      {suggested && (
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
          {t("suggested", { wikidata: suggested.wikidata })}
          {op.confidence ? ` · ${t("confidence", { value: op.confidence })}` : ""}
          {op.reasoning ? ` · ${op.reasoning}` : ""}
        </p>
      )}

      <fieldset className="mb-2 flex flex-col gap-1">
        <legend className="text-xs font-medium">{t("candidates")}</legend>
        {op.candidates.map((c) => (
          <div key={c.wikidata} className="flex flex-wrap items-baseline gap-2">
            <label className="flex items-baseline gap-1">
              <input
                type="radio"
                name={`person-${op.id}`}
                checked={!otherQid.trim() && selected === c.wikidata}
                onChange={() => {
                  setSelected(c.wikidata);
                  setOtherQid("");
                }}
              />
              <span>
                {c.label} — {c.description || t("noDescription")} · {c.born ?? "?"}–{c.died ?? "?"}
                {c.wikidata === suggested?.wikidata ? ` · ${t("suggestedTag")}` : ""}
              </span>
            </label>
            <a className="font-mono text-xs text-blue-700 underline dark:text-blue-400" href={`https://www.wikidata.org/wiki/${c.wikidata}`} target="_blank" rel="noreferrer">
              {c.wikidata}
            </a>
            <span className="text-xs text-slate-500 dark:text-slate-400">{c.evidence.join(", ")}</span>
          </div>
        ))}
        <label className="mt-1 flex items-center gap-2 text-xs">
          {t("otherQid")}
          <input
            className="w-32 rounded border border-slate-300 px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-900"
            value={otherQid}
            placeholder="Q…"
            onChange={(e) => setOtherQid(e.target.value.trim())}
          />
        </label>
      </fieldset>

      {!rejecting ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canAccept}
            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
            onClick={() => onDecide(id, unchanged ? { decision: "accept" } : { decision: "edit", edited: { wikidata: qid } })}
          >
            {unchanged ? t("accept") : t("acceptEdited")}
          </button>
          <button type="button" className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700" onClick={() => setRejecting(true)}>
            {t("noItem")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-1 items-center gap-2 text-xs">
            {t("reason")}
            <input
              className="flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!reason.trim()}
            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
            onClick={() => {
              onDecide(id, { decision: "reject", edited: { reason: reason.trim() } });
              setRejecting(false);
            }}
          >
            {t("confirm")}
          </button>
          <button type="button" className="rounded bg-slate-400 px-2 py-1 text-xs font-medium text-white hover:bg-slate-500" onClick={() => setRejecting(false)}>
            {t("cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
