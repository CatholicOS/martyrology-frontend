"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { decisionClass, decisionLabel } from "@/components/decisionClass";
import { opId, type DecisionRecord, type MentionOp } from "@/lib/changeset";
import { MENTION_TINT, contextSegments, contextWords, editedSpan, mentionLang, mentionRanges, wordsIn } from "@/lib/mention-review";

const button = "rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-40";

interface Props {
  op: MentionOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
}

/**
 * Review card for crmedr's mention ops (add_mention, set_span, remove_mention): the quoted passage
 * with the words marked now struck through and the words to mark underlined, in the kind's tint.
 * Accept takes the op as proposed; "Choose the words" picks a span word by word (the first word, then
 * the last) and records it as an edit, in eulogy offsets. On a remove_mention, Accept and Reject read
 * "Remove the mark" and "Keep the mark". An op whose offsets fall outside its context,
 * or whose words there are not its form, can't be accepted as it is.
 */
export default function MentionCard({ op, decision, onDecide }: Props) {
  const t = useTranslations("Review.mention");
  const p = useTranslations("Review.person");
  const r = useTranslations("Review");
  const uid = opId(op);
  const tint = MENTION_TINT[op.kind];
  const lang = mentionLang(op.edition);
  const words = contextWords(op.context);
  const shown = mentionRanges(op, decision);
  // Accept takes the op as proposed, whatever was saved: judge it as proposed.
  const asProposed = mentionRanges(op);
  const canAccept = asProposed.problem === null && !(op.op === "add_mention" && asProposed.proposed === null);
  const canEdit = op.op !== "remove_mention" && asProposed.problem !== "outside";
  // The warning that says why Accept is disabled (at most one shows), for the button's description.
  const problem = asProposed.problem ?? shown.problem;
  const noSpan = op.op === "add_mention" && asProposed.proposed === null && asProposed.problem === null;
  const warningId = useId();
  const [editing, setEditing] = useState(false);
  // The words picked while editing: the first click starts the span, the second ends it.
  const [pick, setPick] = useState<[number, number] | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const where = op.where === "text" ? p("inText") : p("inFootnote", { n: op.where.footnote });
  const markStyle = `${tint} text-slate-900 dark:text-slate-100`;
  // A remove_mention's Accept removes a mark and its Reject keeps one: say so, not "Accept"/"Reject".
  const removal = op.op === "remove_mention";
  const decided = decision && (removal && decision.decision !== "edit" ? t(decision.decision === "accept" ? "removed" : "kept") : decisionLabel(r, decision));

  const startEditing = () => {
    setPick(wordsIn(words, shown.proposed));
    setAnchor(null);
    setEditing(true);
  };
  const pickWord = (i: number) => {
    if (anchor === null) {
      setAnchor(i);
      setPick([i, i]);
    } else {
      setPick(anchor <= i ? [anchor, i] : [i, anchor]);
      setAnchor(null);
    }
  };
  const picked = pick ? editedSpan(op, words, pick[0], pick[1]) : null;

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${uid}`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {op.eulogy} · {where}
        </span>
        <span className="flex gap-1 text-xs">
          <span className={`rounded px-2 py-0.5 ${markStyle}`}>{t(`kind.${op.kind}`)}</span>
          {op.confidence && <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{op.confidence}</span>}
          {decided && <span className="rounded bg-slate-200 px-2 py-0.5 font-medium dark:bg-slate-800">{decided}</span>}
        </span>
      </div>

      <p className="font-medium">{t(`title.${op.op}`, { kind: op.kind })}</p>
      {op.name && <p className="mb-1 text-slate-700 dark:text-slate-300" lang="la">{op.name}</p>}

      {!editing ? (
        <p className="mb-2 border-l-4 border-slate-300 pl-2 font-serif text-base dark:border-slate-700" lang={lang}>
          {contextSegments(op.context, shown.current, shown.proposed).map((s, i) =>
            s.proposed ? (
              <ins key={i} className={`${markStyle} underline decoration-2 underline-offset-2`}>{s.text}</ins>
            ) : s.current ? (
              <del key={i} className={`${markStyle} decoration-2`}>{s.text}</del>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </p>
      ) : (
        <>
          <p className="mb-1 text-xs text-slate-600 dark:text-slate-400">{t("hint")}</p>
          <p className="mb-2 border-l-4 border-slate-300 pl-2 font-serif text-base dark:border-slate-700" lang={lang} role="group" aria-label={t("words")}>
            {words.map((w, i) => {
              const on = pick !== null && i >= pick[0] && i <= pick[1];
              return (
                <span key={w.start}>
                  {op.context.slice(i === 0 ? 0 : words[i - 1].end, w.start)}
                  <button
                    type="button"
                    aria-pressed={on}
                    className={`inline rounded-sm font-serif ${on ? `${markStyle} underline` : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                    onClick={() => pickWord(i)}
                  >
                    {w.text}
                  </button>
                </span>
              );
            })}
            {op.context.slice(words.length ? words[words.length - 1].end : 0)}
          </p>
          <p role="status" aria-live="polite" className="mb-2 text-xs">{picked ? t("selected", { form: picked.form }) : ""}</p>
        </>
      )}

      {/* The legend is plain spans styled like the marks, so <ins>/<del> appear only in the passage. */}
      {!editing && (
        <p className="mb-2 flex gap-3 text-xs text-slate-600 dark:text-slate-400">
          {shown.current && <span className={`${markStyle} line-through`}>{t("current")}</span>}
          {shown.proposed && <span className={`${markStyle} underline`}>{t("proposed")}</span>}
        </p>
      )}
      {problem === "outside" && <p id={warningId} className="mb-2 text-xs text-amber-700 dark:text-amber-400">{t("outside")}</p>}
      {problem === "changed" && <p id={warningId} className="mb-2 text-xs text-amber-700 dark:text-amber-400">{t("changed")}</p>}
      {noSpan && (
        <p id={warningId} className="mb-2 text-xs text-amber-700 dark:text-amber-400">{t("noSpan")}</p>
      )}
      {op.reasoning && <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">{t("why", { text: op.reasoning })}</p>}

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!canAccept} aria-describedby={!canAccept ? warningId : undefined} className={`${button} bg-green-600 hover:bg-green-700`} onClick={() => onDecide(uid, { decision: "accept" })}>
            {removal ? t("remove") : r("actions.accept")}
          </button>
          <button type="button" className={`${button} bg-red-600 hover:bg-red-700`} onClick={() => onDecide(uid, { decision: "reject" })}>
            {removal ? t("keep") : r("actions.reject")}
          </button>
          {!removal && (
            <button type="button" disabled={!canEdit} className={`${button} bg-slate-600 hover:bg-slate-700`} onClick={startEditing}>
              {t("choose")}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!picked}
            className={`${button} bg-amber-600 hover:bg-amber-700`}
            onClick={() => {
              if (!picked) return;
              onDecide(uid, { decision: "edit", edited: picked });
              setEditing(false);
            }}
          >
            {t("save")}
          </button>
          <button type="button" className={`${button} bg-slate-400 hover:bg-slate-500`} onClick={() => setEditing(false)}>
            {r("actions.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
