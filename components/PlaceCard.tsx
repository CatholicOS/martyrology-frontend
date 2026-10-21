"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import EulogyView from "@/components/EulogyView";
import PlaceMap from "@/components/PlaceMap";
import { decisionClass, decisionLabel } from "@/components/decisionClass";
import type { DecisionRecord, ResolvePlaceOp, TextSays } from "@/lib/changeset";
import { placeCountryFor, placeDefaultQid, placeJevBlock, placeJevRecord } from "@/lib/place-review";
import type { Locale } from "@/lib/types";

interface Props {
  op: ResolvePlaceOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
  locale: Locale;
  baseEdition: string;
}

const ISO = /^[A-Z]{2}$/;
const JEV_KINDS: readonly string[] = ["place", "people", "relative", "not_place"];
const claimKey = (c: TextSays) => `${c.country}|${c.it}`;

/**
 * Review card for a crmedr gazetteer `resolve_place` op: pick the Wikidata item
 * for a printed Latin place and the country it lies in today. The decision follows
 * crmedr's `build_gazetteer.py apply`: an unchanged suggestion (or top candidate)
 * is a plain accept, any change is an edit, and a reject carries a reason.
 * `text_says` is not chosen: `apply` derives it from the Italian's explicit
 * modern-country claims ("nell'odierna X", "oggi in X") that disagree with the
 * chosen country, and the card shows that derivation read-only.
 */
// The CEI Italian of the 2004 edition, shown beside the Latin: the queue's Italian
// place phrases come from it, so the curator compares like with like.
const ITALIAN_2004 = "martyrologium_romanum_2004_it_IT";

export default function PlaceCard({ op, decision, onDecide, locale, baseEdition }: Props) {
  const t = useTranslations("Map.place");
  const tr = useTranslations("Review");
  const suggested = op.suggested ?? null;
  const byQid = new Map(op.candidates.map((c) => [c.wikidata, c]));

  const countryFor = (qid: string) => placeCountryFor(op, qid);
  const defaultQid = placeDefaultQid(op);
  const defaultCountry = countryFor(defaultQid);

  // Seeded from a saved edit (resume), then from the default.
  const ed = decision?.decision === "edit" ? decision.edited : undefined;
  const seedQid = ed?.wikidata ?? defaultQid;
  const seedCountry = ed?.country ?? countryFor(seedQid);
  const [selected, setSelected] = useState(byQid.has(seedQid) ? seedQid : defaultQid);
  const [otherQid, setOtherQid] = useState(byQid.has(seedQid) ? "" : seedQid);
  const [country, setCountry] = useState(seedCountry);
  // A macro-area (the Orient, Africa) lies in no single country: crmedr records country null.
  const [noCountry, setNoCountry] = useState(ed?.no_country === true);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(decision?.decision === "reject" ? (decision.edited?.reason ?? "") : "");
  const [openEulogy, setOpenEulogy] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  const qid = otherQid.trim() || selected;
  const canAccept = /^Q[1-9]\d*$/.test(qid) && (noCountry || ISO.test(country));
  const unchanged = !noCountry && qid === defaultQid && country === defaultCountry;
  const textSays = noCountry ? [] : op.claims.filter((c) => c.country !== country);

  const jev = op.jev;
  const jevRecord = placeJevRecord(op);
  const jevBlock = placeJevBlock(op);
  const jevLabel = op.candidates.find((c) => c.wikidata === jev?.wikidata)?.label;
  // The QID too: two candidates can share a label.
  const jevWhat = jev?.decision === "reject" ? t("jevNone") : [jev?.wikidata, jevLabel].filter(Boolean).join(" ");

  const choose = (q: string) => {
    setSelected(q);
    setOtherQid("");
    setCountry(countryFor(q));
  };
  const accept = () =>
    onDecide(
      op.id,
      unchanged
        ? { decision: "accept" }
        : {
            decision: "edit",
            edited: noCountry ? { wikidata: qid, no_country: true } : { wikidata: qid, country },
          }
    );

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${op.id}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {t("occurrences", { count: op.occurrences.length })}
        </span>
        <span className="flex items-center gap-2">
          {op.prefilled === "jev" && (
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
              {t("prefilled")}
            </span>
          )}
          {decision && (
            <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
              {decisionLabel(tr, decision)}
            </span>
          )}
        </span>
      </div>

      <p className="text-base font-semibold">{op.la}</p>
      <ul className="mb-2 text-slate-700 dark:text-slate-300">
        {op.it.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
      {op.failed.length > 0 && (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">{t("notAutomatic", { reasons: op.failed.join("; ") })}</p>
      )}

      <div className="mb-2 flex flex-wrap gap-1">
        {op.occurrences.map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded px-1.5 py-0.5 font-mono text-xs ${openEulogy === m ? "bg-slate-300 dark:bg-slate-700" : "bg-slate-100 dark:bg-slate-800"}`}
            onClick={() => setOpenEulogy(openEulogy === m ? null : m)}
          >
            {m}
          </button>
        ))}
      </div>
      {openEulogy && (
        <div className="mb-2">
          <EulogyView id={openEulogy} baseEdition={baseEdition} locale={locale} alongside={ITALIAN_2004} />
        </div>
      )}

      {suggested && (
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
          {t.rich("suggested", {
            wikidata: suggested.wikidata,
            country: suggested.country,
            qid: (chunks) => <span className="font-mono">{chunks}</span>,
          })}
          {op.confidence ? ` · ${t("confidence", { value: op.confidence })}` : ""}
          {op.reasoning ? ` · ${op.reasoning}` : ""}
        </p>
      )}
      {!suggested && op.reasoning && (
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
          {t("noneSuggested")}
          {op.confidence ? ` · ${t("confidence", { value: op.confidence })}` : ""} · {op.reasoning}
        </p>
      )}

      <fieldset className="mb-2 flex flex-col gap-1">
        <legend className="text-xs font-medium">{t("candidates")}</legend>
        {op.candidates.map((c) => (
          <div key={c.wikidata} className="flex flex-wrap items-baseline gap-2">
            <label className="flex items-baseline gap-1">
              <input
                type="radio"
                name={`place-${op.id}`}
                checked={!otherQid.trim() && selected === c.wikidata}
                onChange={() => choose(c.wikidata)}
              />
              <span>
                {c.label} — {c.description || t("noDescription")} · {c.country ?? (c.countries.join("/") || "?")}
                {c.wikidata === suggested?.wikidata ? ` · ${t("suggestedTag")}` : ""}
              </span>
            </label>
            <a className="font-mono text-xs text-blue-700 underline dark:text-blue-400" href={`https://www.wikidata.org/wiki/${c.wikidata}`} target="_blank" rel="noreferrer">
              {c.wikidata}
            </a>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {c.la.length > 0 ? `la: ${c.la.slice(0, 4).join(", ")} · ` : ""}
              {c.evidence.join(", ")}
            </span>
          </div>
        ))}
        <label className="mt-1 flex items-center gap-2 text-xs">
          {t("otherQid")}
          <input
            className="w-32 rounded border border-slate-300 px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-900"
            value={otherQid}
            placeholder={t("qidPlaceholder")}
            onChange={(e) => setOtherQid(e.target.value.trim())}
          />
        </label>
      </fieldset>

      {jev && (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
          {jev.decision && <span>{t("jevSuggests", { what: jevWhat, confidence: Math.round((jev.probability ?? 0) * 100) })}</span>}
          {(!jev.decision || jev.kind !== "place") && (
            <span className="text-amber-700 dark:text-amber-400">{JEV_KINDS.includes(jev.kind) ? t(`jevKind.${jev.kind}`) : jev.kind}</span>
          )}
        </p>
      )}

      <div className="mb-2">
        <button
          type="button"
          className="rounded bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-800"
          onClick={() => setShowMap(!showMap)}
        >
          {showMap ? t("hideMap") : t("showMap")}
        </button>
        {showMap && (
          <div className="mt-1" data-testid="place-map-panel">
            <PlaceMap points={op.candidates} selected={qid} onSelect={choose} />
          </div>
        )}
      </div>

      <div className="mb-2 flex flex-col gap-1">
        <label className="flex items-center gap-2 text-xs">
          {t("country")}
          <input
            className="w-16 rounded border border-slate-300 px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-900"
            value={country}
            maxLength={3}
            disabled={noCountry}
            onChange={(e) => setCountry(e.target.value.trim().toUpperCase())}
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={noCountry} onChange={(e) => setNoCountry(e.target.checked)} />
          {t("noCountry")}
        </label>
        {ISO.test(country) && textSays.length > 0 && (
          <ul className="text-xs text-amber-700 dark:text-amber-400" data-testid="text-says">
            {textSays.map((c) => (
              <li key={claimKey(c)}>
                {t("italianSays", { claimed: c.country, phrase: c.it, country })}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          {jev?.decision && (
            <button
              type="button"
              disabled={!jevRecord}
              title={jevBlock ? t(`takeDisabled.${jevBlock}`) : undefined}
              className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              onClick={() => {
                if (!jevRecord) return;
                setNoCountry(false);
                const pick = jevRecord.decision === "reject" ? null : { wikidata: jev.wikidata, country: jev.country };
                if (pick?.wikidata && pick.country) {
                  setSelected(pick.wikidata);
                  setOtherQid("");
                  setCountry(pick.country);
                }
                onDecide(op.id, jevRecord);
              }}
            >
              {t("take")}
            </button>
          )}
          <button
            type="button"
            disabled={!canAccept}
            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
            onClick={accept}
          >
            {unchanged ? t("accept") : t("acceptEdited")}
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
            onClick={() => setRejecting(true)}
          >
            {t("reject")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-1 items-center gap-2 text-xs">
            {t("reason")}
            <input
              className="flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              value={reason}
              placeholder={t("reasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!reason.trim()}
            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
            onClick={() => {
              onDecide(op.id, { decision: "reject", edited: { reason: reason.trim() } });
              setRejecting(false);
            }}
          >
            {t("confirmReject")}
          </button>
          <button
            type="button"
            className="rounded bg-slate-400 px-2 py-1 text-xs font-medium text-white hover:bg-slate-500"
            onClick={() => setRejecting(false)}
          >
            {t("cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
