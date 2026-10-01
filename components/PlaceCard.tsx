"use client";

import { useState } from "react";
import EulogyView from "@/components/EulogyView";
import PlaceMap from "@/components/PlaceMap";
import { decisionClass } from "@/components/decisionClass";
import type { DecisionRecord, ResolvePlaceOp, TextSays } from "@/lib/changeset";
import type { Locale } from "@/lib/types";

interface Props {
  op: ResolvePlaceOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
  locale: Locale;
  baseEdition: string;
}

const ISO = /^[A-Z]{2}$/;
const claimKey = (c: TextSays) => `${c.country}|${c.it}`;

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/**
 * Review card for a crmedr gazetteer `resolve_place` op: pick the Wikidata item
 * for a printed Latin place, its actual modern country, and which modern-country
 * claims of the Italian text to record as `text_says`. The decision follows
 * crmedr's `build_gazetteer.py apply`: an unchanged suggestion (or top candidate)
 * is a plain accept, any change is an edit, and a reject carries a reason.
 */
export default function PlaceCard({ op, decision, onDecide, locale, baseEdition }: Props) {
  const suggested = op.suggested ?? null;
  const byQid = new Map(op.candidates.map((c) => [c.wikidata, c]));

  const countryFor = (qid: string) =>
    suggested && suggested.wikidata === qid ? suggested.country : (byQid.get(qid)?.country ?? "");
  const textSaysFor = (qid: string, country: string) =>
    new Set(
      suggested && suggested.wikidata === qid
        ? (suggested.text_says ?? []).map(claimKey)
        : op.claims.filter((c) => c.country !== country).map(claimKey)
    );

  const defaultQid = suggested?.wikidata ?? op.candidates[0]?.wikidata ?? "";
  const defaultCountry = countryFor(defaultQid);
  const defaultChecked = textSaysFor(defaultQid, defaultCountry);

  // Seeded from a saved edit (resume), then from the default.
  const ed = decision?.decision === "edit" ? decision.edited : undefined;
  const seedQid = ed?.wikidata ?? defaultQid;
  const seedCountry = ed?.country ?? countryFor(seedQid);
  const [selected, setSelected] = useState(byQid.has(seedQid) ? seedQid : defaultQid);
  const [otherQid, setOtherQid] = useState(byQid.has(seedQid) ? "" : seedQid);
  const [country, setCountry] = useState(seedCountry);
  const [checked, setChecked] = useState<Set<string>>(
    ed?.text_says ? new Set(ed.text_says.map(claimKey)) : textSaysFor(seedQid, seedCountry)
  );
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(decision?.decision === "reject" ? (decision.edited?.reason ?? "") : "");
  const [openEulogy, setOpenEulogy] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  const qid = otherQid.trim() || selected;
  const canAccept = /^Q[1-9]\d*$/.test(qid) && ISO.test(country);
  const unchanged = qid === defaultQid && country === defaultCountry && sameSet(checked, defaultChecked);

  const choose = (q: string) => {
    setSelected(q);
    setOtherQid("");
    const c = countryFor(q);
    setCountry(c);
    setChecked(textSaysFor(q, c));
  };
  const toggleClaim = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChecked(next);
  };
  const accept = () =>
    onDecide(
      op.id,
      unchanged
        ? { decision: "accept" }
        : {
            decision: "edit",
            edited: { wikidata: qid, country, text_says: op.claims.filter((c) => checked.has(claimKey(c))) },
          }
    );

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${op.id}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {op.occurrences.length} occurrence{op.occurrences.length === 1 ? "" : "s"}
        </span>
        {decision && (
          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
            {decision.decision}
          </span>
        )}
      </div>

      <p className="text-base font-semibold">{op.la}</p>
      <ul className="mb-2 text-slate-700 dark:text-slate-300">
        {op.it.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
      {op.failed.length > 0 && (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">Not automatic: {op.failed.join("; ")}</p>
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
          <EulogyView id={openEulogy} baseEdition={baseEdition} locale={locale} />
        </div>
      )}

      {suggested && (
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
          Suggested <span className="font-mono">{suggested.wikidata}</span> ({suggested.country})
          {op.confidence ? ` · confidence: ${op.confidence}` : ""}
          {op.reasoning ? ` · ${op.reasoning}` : ""}
        </p>
      )}
      {!suggested && op.reasoning && (
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
          No item suggested{op.confidence ? ` · confidence: ${op.confidence}` : ""} · {op.reasoning}
        </p>
      )}

      <fieldset className="mb-2 flex flex-col gap-1">
        <legend className="text-xs font-medium">Candidates</legend>
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
                {c.label} — {c.description || "(no description)"} · {c.country ?? (c.countries.join("/") || "?")}
                {c.wikidata === suggested?.wikidata ? " · suggested" : ""}
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
          Other QID
          <input
            className="w-32 rounded border border-slate-300 px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-900"
            value={otherQid}
            placeholder="Q…"
            onChange={(e) => setOtherQid(e.target.value.trim())}
          />
        </label>
      </fieldset>

      <div className="mb-2">
        <button
          type="button"
          className="rounded bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-800"
          onClick={() => setShowMap(!showMap)}
        >
          {showMap ? "Hide map" : "Show map"}
        </button>
        {showMap && (
          <div className="mt-1" data-testid="place-map-panel">
            <PlaceMap points={op.candidates} selected={qid} onSelect={choose} />
          </div>
        )}
      </div>

      <div className="mb-2 flex flex-col gap-1">
        <label className="flex items-center gap-2 text-xs">
          Country
          <input
            className="w-16 rounded border border-slate-300 px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-900"
            value={country}
            maxLength={3}
            onChange={(e) => setCountry(e.target.value.trim().toUpperCase())}
          />
        </label>
        {op.claims.map((c) => (
          <label key={claimKey(c)} className="flex items-baseline gap-1 text-xs">
            <input type="checkbox" checked={checked.has(claimKey(c))} onChange={() => toggleClaim(claimKey(c))} />
            <span>
              the text says {c.country}: “{c.it}” — record as text_says
            </span>
          </label>
        ))}
      </div>

      {!rejecting ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canAccept}
            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
            onClick={accept}
          >
            Accept{unchanged ? "" : " (edited)"}
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
            onClick={() => setRejecting(true)}
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-1 items-center gap-2 text-xs">
            Reason
            <input
              className="flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              value={reason}
              placeholder="why no Wikidata item fits"
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
            Confirm reject
          </button>
          <button
            type="button"
            className="rounded bg-slate-400 px-2 py-1 text-xs font-medium text-white hover:bg-slate-500"
            onClick={() => setRejecting(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
