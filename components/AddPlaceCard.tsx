"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getElogium } from "@/lib/api";
import { PLACE_ROLES, printings, printingSpan, type PlaceRole } from "@/lib/body-places";
import { decisionClass, decisionLabel } from "@/components/decisionClass";
import type { AddPlaceOp, DecisionRecord, EditedFields } from "@/lib/changeset";

const LATIN = "martyrologium_romanum_2004";
const ITALIAN = "martyrologium_romanum_2004_it_IT";

interface Props {
  op: AddPlaceOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
}

/** A person is "Name", or "Name#n" for the nth person of a name (n from 2), as option values. */
const personKey = (name?: string | null, n?: number | null) => (name ? (n && n > 1 ? `${name}#${n}` : name) : "");

/** One text with the nth printing of form marked; nothing marked when it is not printed. */
function Marked({ text, form, n, testId }: { text: string; form: string; n?: number | null; testId: string }) {
  const span = form ? printingSpan(text, form, n) : null;
  if (!span) return <span className="font-serif">{text}</span>;
  return (
    <span className="font-serif">
      <span>{text.slice(0, span.start)}</span>
      <mark data-testid={testId} className="rounded-sm bg-amber-200 px-0.5 dark:bg-amber-700/60">
        {text.slice(span.start, span.end)}
      </mark>
      <span>{text.slice(span.end)}</span>
    </span>
  );
}

/**
 * Review card for crmedr's `add_place` op: a place the eulogy names outside its opening
 * place, with its role. Both 2004 texts are shown with the proposed printing marked; an
 * edit may change the role, the words (as printed), which printing, and whose role it
 * is. crmedr's `body_places.py apply` validates the result again.
 */
export default function AddPlaceCard({ op, decision, onDecide }: Props) {
  const t = useTranslations("Review.addPlace");
  const tr = useTranslations("Review");
  const [texts, setTexts] = useState<{ la: string; it: string } | null>(null);
  const [failed, setFailed] = useState(false);
  // Seeded from a saved edit (resume), then from the proposal.
  const ed = decision?.decision === "edit" ? decision.edited : undefined;
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<PlaceRole>(ed?.role ?? op.role);
  const [la, setLa] = useState(ed?.la ?? op.la);
  const [it, setIt] = useState(ed?.it === null ? "" : (ed?.it ?? op.it ?? ""));
  const [occ, setOcc] = useState<number | null>(ed?.occurrence !== undefined ? ed.occurrence : (op.occurrence ?? null));
  const [occIt, setOccIt] = useState<number | null>(
    ed?.occurrence_it !== undefined ? ed.occurrence_it : (op.occurrence_it ?? null)
  );
  const [person, setPerson] = useState(
    ed?.person !== undefined ? personKey(ed.person, ed.n) : personKey(op.person, op.n)
  );

  useEffect(() => {
    let cancelled = false;
    getElogium(op.eulogy)
      .then((e) => {
        if (!cancelled) setTexts({ la: e.editions[LATIN]?.text ?? "", it: e.editions[ITALIAN]?.text ?? "" });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [op.eulogy]);

  const laCount = texts ? printings(texts.la, la).length : 0;
  const itCount = texts && it ? printings(texts.it, it).length : 0;
  // A form printed once needs no printing; printed several times, one must be chosen.
  const laOcc = laCount > 1 ? occ : null;
  const itOcc = itCount > 1 ? occIt : null;
  const canSave = laCount === 1 || (laCount > 1 && laOcc !== null && laOcc <= laCount);

  const [pName, pNs] = person ? person.split("#") : [null, undefined];
  const pN = pNs ? Number(pNs) : null;
  const save = () => {
    const edited: EditedFields = {};
    if (role !== op.role) edited.role = role;
    if (la !== op.la) edited.la = la;
    if ((it || null) !== (op.it ?? null)) edited.it = it || null;
    if (laOcc !== (op.occurrence ?? null)) edited.occurrence = laOcc;
    if (itOcc !== (op.occurrence_it ?? null)) edited.occurrence_it = itOcc;
    if (pName !== (op.person ?? null)) edited.person = pName;
    if (pN !== (op.n ?? null)) edited.n = pN;
    onDecide(op.id, Object.keys(edited).length ? { decision: "edit", edited } : { decision: "accept" });
    setEditing(false);
  };

  const input = "flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900";
  const printingSelect = (label: string, count: number, value: number | null, set: (n: number | null) => void) =>
    count > 1 && (
      <label className="flex items-center gap-2 text-xs">
        {label}
        <select
          aria-label={label}
          className="rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900"
          value={value ?? ""}
          onChange={(e) => set(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{t("choosePrinting", { count })}</option>
          {Array.from({ length: count }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
    );

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${op.id}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {op.eulogy}
        </span>
        {decision && (
          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
            {decisionLabel(tr, decision)}
          </span>
        )}
      </div>
      <p className="mb-1">
        <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium dark:bg-amber-900/50">
          {t(`roles.${role}`)}
        </span>
        <span className="font-semibold">{la}</span>
        {it && <span className="text-slate-600 dark:text-slate-400"> · {it}</span>}
        {pName && <span className="text-xs text-slate-500 dark:text-slate-400"> · {t("whose", { person: pName })}</span>}
      </p>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        {op.confidence ? t("confidence", { value: op.confidence }) : ""}
        {op.reasoning ? ` · ${op.reasoning}` : ""}
      </p>

      {!texts && !failed && <p className="text-slate-500 dark:text-slate-400">{t("loading")}</p>}
      {failed && <p className="text-red-600 dark:text-red-400">{t("unavailable")}</p>}
      {texts && (
        <div className="mb-2 grid gap-3 rounded bg-slate-50 p-2 sm:grid-cols-2 dark:bg-slate-900">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("latin")}</p>
            <Marked text={texts.la} form={la} n={laOcc} testId="la-mark" />
            {laCount === 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{t("notPrinted")}</p>}
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("italian")}</p>
            <Marked text={texts.it} form={it} n={itOcc} testId="it-mark" />
            {it && itCount === 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{t("notPrinted")}</p>}
          </div>
        </div>
      )}

      {!editing ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
            onClick={() => onDecide(op.id, { decision: "accept" })}
          >
            {tr("actions.accept")}
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
            onClick={() => onDecide(op.id, { decision: "reject" })}
          >
            {tr("actions.reject")}
          </button>
          <button
            type="button"
            className="rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
            onClick={() => setEditing(true)}
          >
            {tr("actions.edit")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs">
            {t("role")}
            <select aria-label={t("role")} className={input} value={role} onChange={(e) => setRole(e.target.value as PlaceRole)}>
              {PLACE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            {t("latin")}
            <input aria-label={t("latin")} className={input} value={la} onChange={(e) => setLa(e.target.value)} />
          </label>
          {printingSelect(t("latinPrinting"), laCount, laOcc, setOcc)}
          <label className="flex items-center gap-2 text-xs">
            {t("italian")}
            <input aria-label={t("italian")} className={input} value={it} onChange={(e) => setIt(e.target.value)} />
          </label>
          {printingSelect(t("italianPrinting"), itCount, itOcc, setOccIt)}
          {op.persons && op.persons.length > 0 && (
            <label className="flex items-center gap-2 text-xs">
              {t("person")}
              <select aria-label={t("person")} className={input} value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="">{t("everyone")}</option>
                {op.persons.map((p) => (
                  <option key={personKey(p.name, p.n)} value={personKey(p.name, p.n)}>
                    {p.name}
                    {p.n ? ` (${p.n})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canSave}
              className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-40"
              onClick={save}
            >
              {tr("actions.saveEdit")}
            </button>
            <button
              type="button"
              className="rounded bg-slate-400 px-2 py-1 text-xs font-medium text-white hover:bg-slate-500"
              onClick={() => setEditing(false)}
            >
              {tr("actions.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
