"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import EulogyView from "@/components/EulogyView";
import { decisionClass, decisionLabel } from "@/components/decisionClass";
import { opId, type DecisionRecord, type ListedPerson, type SetPersonsOp } from "@/lib/changeset";
import type { Locale } from "@/lib/types";

const button = "rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-40";
// Beside the Latin: the Italian 2004, which prints the names in the same order.
const ALONGSIDE = ["martyrologium_romanum_2004_it_IT"];

interface Props {
  op: SetPersonsOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
  locale: Locale;
  baseEdition: string;
}

/** "Fictianus · Fiziano": the Latin name, then its Italian form when given. */
const personLine = (p: ListedPerson) => (p.it ? `${p.name} · ${p.it}` : p.name);
/** The textarea's line of a person: "Fictianus | Fiziano". */
const editLine = (p: ListedPerson) => (p.it ? `${p.name} | ${p.it}` : p.name);

/** The persons of the textarea, one per line ("Latin | Italian"); blank lines are skipped. */
export function parsePersons(text: string): ListedPerson[] {
  return text
    .split("\n")
    .map((line) => {
      const [name, it] = line.split("|").map((x) => x.trim());
      return it ? { name, it } : { name };
    })
    .filter((p) => p.name);
}

const sameList = (a: ListedPerson[], b: ListedPerson[]) =>
  a.length === b.length && a.every((p, i) => p.name === b[i].name && (p.it || null) === (b[i].it || null));

/**
 * Review card for a crmedr `set_persons` op (persons_review.py): a eulogy whose list of names crmedr
 * could not read to its end. It shows the names read now, the printed forms not read, and the list
 * drafted through to its end, each drafted name with the printed form it comes from and its other
 * readings. Accept writes the drafted list; edit, one person per line ("Latin | Italian"), an edited
 * one; reject keeps the names as read.
 */
export default function PersonsListCard({ op, decision, onDecide, locale, baseEdition }: Props) {
  const t = useTranslations("Review.persons");
  const r = useTranslations("Review");
  const uid = opId(op);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const savedEdit = decision?.decision === "edit" ? (decision.edited?.persons ?? null) : null;
  const edited = parsePersons(text);

  const startEdit = () => {
    setText((savedEdit ?? op.persons).map(editLine).join("\n"));
    setEditing(true);
  };

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${uid}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {uid}
        </span>
        {decision && <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">{decisionLabel(r, decision)}</span>}
      </div>

      <div className="mb-2">
        <EulogyView id={op.id} baseEdition={baseEdition} locale={locale} alongside={ALONGSIDE} />
      </div>

      <p className="mb-1 text-xs">
        <span className="font-medium">{t("current")}</span>{" "}
        <span lang="la" className="text-slate-700 dark:text-slate-300">
          {op.current.join("; ") || "—"}
        </span>
      </p>
      <p className="mb-1 text-xs">
        <span className="font-medium">{t("unread")}</span>{" "}
        {op.unread.map((u, i) => (
          <span key={u}>
            {i > 0 && "; "}
            <mark lang="la" className="rounded bg-amber-100 px-1 text-slate-900 dark:bg-amber-900 dark:text-slate-100">
              {u}
            </mark>
          </span>
        ))}
      </p>
      <p className="mb-1 text-xs font-medium">{t("proposed")}</p>
      <ol className="mb-1 ml-5 list-decimal text-xs">
        {op.persons.map((p, i) => (
          <li key={`${p.name}-${i}`}>
            <span lang="la">{personLine(p)}</span>
            {p.printed && (
              <span className="text-slate-500 dark:text-slate-400">
                {" "}({t("from", { printed: p.printed })}
                {p.alternatives?.length ? `; ${t("or", { names: p.alternatives.join(", ") })}` : ""})
              </span>
            )}
          </li>
        ))}
      </ol>
      {savedEdit && (
        <p className="mb-1 text-xs text-slate-700 dark:text-slate-300">{t("edited", { persons: savedEdit.map(personLine).join("; ") })}</p>
      )}

      {!editing ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={`${button} bg-green-600 hover:bg-green-700`} onClick={() => onDecide(uid, { decision: "accept" })}>
            {t("accept")}
          </button>
          <button type="button" className={`${button} bg-slate-600 hover:bg-slate-700`} onClick={startEdit}>
            {t("edit")}
          </button>
          <button type="button" className={`${button} bg-red-600 hover:bg-red-700`} onClick={() => onDecide(uid, { decision: "reject" })}>
            {t("keep")}
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span>{t("editHelp")}</span>
            <textarea
              lang="la"
              rows={Math.max(4, text.split("\n").length + 1)}
              className="rounded border border-slate-300 px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-900"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={edited.length === 0}
              className={`${button} bg-amber-600 hover:bg-amber-700`}
              onClick={() => {
                if (sameList(edited, op.persons)) onDecide(uid, { decision: "accept" });
                else onDecide(uid, { decision: "edit", edited: { persons: edited } });
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
