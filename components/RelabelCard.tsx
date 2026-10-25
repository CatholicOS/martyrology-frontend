"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import EulogyView from "@/components/EulogyView";
import { decisionClass, decisionLabel } from "@/components/decisionClass";
import { opId, type DecisionRecord, type RelabelOp, type RenameOp, type SubjectLabels } from "@/lib/changeset";
import { canFollow, followedSubject } from "@/lib/subject-review";
import type { Locale } from "@/lib/types";

const button = "rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-40";
const input = "flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900";
// Beside a single eulogy: the Italian 2004, else the 1914 English (as RenameCard).
const ALONGSIDE = ["martyrologium_romanum_2004_it_IT", "martyrologium_romanum_1914_en_unofficial"];
const LANGS = ["la", "en", "it"] as const;

interface Props {
  op: RelabelOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
  locale: Locale;
  baseEdition: string;
  /** The eulogy's rename and its current decision: the subject follows the ID. */
  rename?: RenameOp;
  renameDecision?: DecisionRecord;
}

/** Latin · English · Italian, a dash for a missing language. */
const labelsLine = (l: SubjectLabels) => LANGS.map((k) => l[k] ?? "—").join(" · ");

/**
 * Review card for a eulogy's subject (crmedr subject identity): the subject follows the ID. It shows
 * the current subject and the one the decided ID implies (the proposed ID while the rename is
 * undecided; follow waits for the decided ID); follow the ID (accept), edit the wording (three labels) or keep the current subject.
 * Jev is not asked about the subject: its rename pick already chooses the pairing.
 */
export default function RelabelCard({ op, decision, onDecide, locale, baseEdition, rename, renameDecision }: Props) {
  const t = useTranslations("Review.relabel");
  const r = useTranslations("Review");
  const uid = opId(op);
  const followed = followedSubject(op, rename, renameDecision);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Record<(typeof LANGS)[number], string>>({ la: "", en: "", it: "" });
  const savedEdit = decision?.decision === "edit" ? (decision.edited?.labels ?? null) : null;
  const reason =
    followed.id === null
      ? t("noId")
      : followed.labels === null
        ? t("typedId", { id: followed.id })
        : followed.undecided
          ? t("undecidedId") // crmedr rejects an accepted relabel with no decided rename
          : null;

  // An accept recorded while the ID gave a subject, which no longer does: crmedr's apply would reject it.
  const stale = decision?.decision === "accept" && reason !== null;

  const startEdit = () => {
    const seed = savedEdit ?? followed.labels ?? op.current;
    setFields({ la: seed.la ?? "", en: seed.en ?? "", it: seed.it ?? "" });
    setEditing(true);
  };

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${uid}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {uid}
        </span>
        {stale ? (
          <span role="alert" className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {t("staleAccept")}
          </span>
        ) : (
          decision && (
            <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">{decisionLabel(r, decision)}</span>
          )
        )}
      </div>

      <div className="mb-2">
        <EulogyView id={op.id} baseEdition={baseEdition} locale={locale} alongside={ALONGSIDE} />
      </div>

      <p className="mb-1 text-xs">
        <span className="font-medium">{t("current")}</span>{" "}
        <span className="text-slate-700 dark:text-slate-300">{labelsLine(op.current)}</span>
      </p>
      {followed.id !== null && followed.labels !== null && (
        <p className="mb-1 text-xs">
          <span className={`font-medium ${followed.undecided ? "text-amber-700 dark:text-amber-400" : ""}`}>
            {followed.undecided ? t("followsUndecided", { id: followed.id }) : t("follows", { id: followed.id })}
          </span>{" "}
          <span className="text-slate-700 dark:text-slate-300">{labelsLine(followed.labels)}</span>
        </p>
      )}
      {reason && <p className="mb-1 text-xs text-amber-700 dark:text-amber-400">{reason}</p>}
      {op.hint && (
        <p className="mb-1 text-xs text-slate-600 dark:text-slate-400">
          <span>{t("hint", { labels: [op.hint.labels.en, op.hint.labels.it].map((x) => x ?? "—").join(" · ") })}</span>{" "}
          (
          <a
            className="font-mono underline"
            href={`https://www.wikidata.org/wiki/${op.hint.wikidata}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {op.hint.wikidata}
          </a>
          ) — <span className="italic">{t("hintNote")}</span>
        </p>
      )}
      {savedEdit && <p className="mb-1 text-xs text-slate-700 dark:text-slate-300">{t("edited", { labels: labelsLine(savedEdit) })}</p>}

      {!editing ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={reason !== null}
            title={reason ?? undefined}
            className={`${button} bg-green-600 hover:bg-green-700`}
            onClick={() => onDecide(uid, { decision: "accept" })}
          >
            {t("follow")}
          </button>
          <button type="button" className={`${button} bg-slate-600 hover:bg-slate-700`} onClick={startEdit}>
            {t("editWording")}
          </button>
          <button type="button" className={`${button} bg-red-600 hover:bg-red-700`} onClick={() => onDecide(uid, { decision: "reject" })}>
            {t("keep")}
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
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
                const same = (a: SubjectLabels, b: SubjectLabels) => LANGS.every((k) => (a[k] ?? null) === (b[k] ?? null));
                if (followed.labels !== null && canFollow(followed) && same(labels, followed.labels)) onDecide(uid, { decision: "accept" });
                else if (same(labels, op.current)) onDecide(uid, { decision: "reject" });
                else onDecide(uid, { decision: "edit", edited: { labels } });
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
