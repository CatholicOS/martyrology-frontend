"use client";

import { useState } from "react";
import EulogyText from "@/components/EulogyText";
import styles from "@/components/page.module.css";
import { decisionClass } from "@/components/decisionClass";
import { opId, type AttachNoteOp, type DecisionRecord } from "@/lib/changeset";
import type { PageFootnote } from "@/lib/footnotes";
import {
  CLASS_WORDS,
  anchorProblem,
  attachDecision,
  attachPlace,
  scanImageUrl,
  scanPageUrl,
  type NotePlace,
} from "@/lib/notationes";

const EDITION = "martyrologium_romanum_1630";
const input = "rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900";
const button = "rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-40";

interface Props {
  op: AttachNoteOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
}

function opening(text: string, n = 8): string {
  const words = text.split(/\s+/);
  return words.slice(0, n).join(" ") + (words.length > n ? " …" : "");
}

/** The eulogy's 1630 text with the note's letter placed after its anchor (at the end without one). */
function Placed({ op, place, uid }: { op: AttachNoteOp; place: NotePlace; uid: string }) {
  const text = op.texts[place.id] ?? "";
  const note: PageFootnote = {
    mark: place.mark,
    after: place.after,
    text: op.note ?? "",
    id: place.id,
    at: 0,
    anchor: `review-${uid}`,
    markAnchor: `review-${uid}-mark`,
    marginalia: [],
  };
  return (
    <div className="mb-2 rounded bg-slate-50 p-2 dark:bg-slate-900/40">
      <p className="mb-1 font-mono text-xs text-slate-500 dark:text-slate-400">{place.id}</p>
      <p className="font-serif" lang="la">
        <EulogyText text={text} id={place.id} edition={EDITION} footnotes={[note]} />
      </p>
    </div>
  );
}

/**
 * Review card for an `attach_note` op (martyrology-api#100): one of Baronius's notes in the 1630
 * edition and where its letter goes, or a letter printed in a eulogy with no note found. The
 * proposal unchanged is an accept; another eulogy, anchor or letter is an edit {id, after, mark}.
 * A letter with no note is accepted as "missing from the book", or given one of the day's notes
 * (edit {note}).
 */
export default function AttachNoteCard({ op, decision, onDecide }: Props) {
  const uid = opId(op);
  const markOnly = op.class === "mark-without-note";
  const saved = attachPlace(op, decision);
  const [editing, setEditing] = useState(false);
  const [place, setPlace] = useState<NotePlace>(saved);
  const [anchor, setAnchor] = useState(saved.after ?? "");
  const [noteRef, setNoteRef] = useState(
    (decision?.decision === "edit" && decision.edited?.note) || op.notes[0]?.ref || ""
  );
  const [showPage, setShowPage] = useState(false);

  const decide = (d: DecisionRecord) => onDecide(uid, d);
  const shown: NotePlace = editing ? { ...place, after: anchor || null } : saved;
  const problem = editing ? anchorProblem(op.texts[place.id] ?? "", anchor) : null;
  const letterOk = /^[a-z]$/.test(place.mark);
  const startEdit = () => {
    setPlace(saved);
    setAnchor(saved.after ?? "");
    setEditing(true);
  };

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${uid}`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {op.day} · {markOnly ? "mark" : "note"} {op.mark}
        </span>
        <span className="flex gap-1 text-xs">
          {op.class && <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{op.class}</span>}
          {decision && (
            <span className="rounded bg-slate-200 px-2 py-0.5 font-medium dark:bg-slate-800">{decision.decision}</span>
          )}
        </span>
      </div>

      <p className="mb-2 font-medium">{CLASS_WORDS[op.class ?? ""] ?? op.class}</p>

      {!markOnly && (
        <p className="mb-2 font-serif" lang="la">
          <span className={styles.fnMark}>{op.mark}</span> {op.note}
        </p>
      )}

      <Placed op={op} place={shown} uid={uid} />
      {problem && <p className="mb-2 text-xs text-red-700 dark:text-red-300">Anchor “{anchor}”: {problem}.</p>}

      <p className="mb-2 flex flex-wrap gap-3 text-xs">
        <a className="text-sky-700 underline dark:text-sky-300" href={scanPageUrl(op.scan_page)} target="_blank" rel="noreferrer">
          Scan page {op.scan_page}
        </a>
        <button type="button" className="text-sky-700 underline dark:text-sky-300" onClick={() => setShowPage(!showPage)}>
          {showPage ? "Hide" : "Show"} the page
        </button>
      </p>
      {showPage && (
        // eslint-disable-next-line @next/next/no-img-element -- a remote scan, shown as is
        <img className="mb-2 w-full max-w-xl border" src={scanImageUrl(op.scan_page)} alt={`Scan page ${op.scan_page}`} loading="lazy" />
      )}

      {markOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={`${button} bg-green-600 hover:bg-green-700`} onClick={() => decide({ decision: "accept" })}>
            Missing from the book
          </button>
          <label className="flex items-center gap-1 text-xs">
            or the day’s note
            <select className={input} value={noteRef} onChange={(e) => setNoteRef(e.target.value)}>
              {op.notes.map((n) => (
                <option key={n.ref} value={n.ref}>
                  {n.mark} · {n.lemma}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!noteRef}
            className={`${button} bg-amber-600 hover:bg-amber-700`}
            onClick={() => decide({ decision: "edit", edited: { note: noteRef } })}
          >
            Give it this note
          </button>
          <button type="button" className={`${button} bg-red-600 hover:bg-red-700`} onClick={() => decide({ decision: "reject" })}>
            Not a reference letter
          </button>
        </div>
      ) : !editing ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${button} bg-green-600 hover:bg-green-700`} onClick={() => decide({ decision: "accept" })}>
            Accept
          </button>
          <button type="button" className={`${button} bg-slate-600 hover:bg-slate-700`} onClick={startEdit}>
            Edit
          </button>
          <button type="button" className={`${button} bg-red-600 hover:bg-red-700`} onClick={() => decide({ decision: "reject" })}>
            Not a note of this day
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs">
            eulogy
            <select
              className={`${input} flex-1`}
              value={place.id}
              onChange={(e) => {
                setPlace({ ...place, id: e.target.value });
                setAnchor("");
              }}
            >
              {Object.entries(op.texts).map(([id, text]) => (
                <option key={id} value={id}>
                  {id} · {opening(text, 6)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            after
            <input
              className={`${input} flex-1`}
              value={anchor}
              placeholder="the words the letter follows (empty: at the end)"
              onChange={(e) => setAnchor(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            letter
            <input
              className={`${input} w-12 font-mono`}
              value={place.mark}
              maxLength={1}
              onChange={(e) => setPlace({ ...place, mark: e.target.value.trim() })}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!!problem || !letterOk}
              className={`${button} bg-amber-600 hover:bg-amber-700`}
              onClick={() => {
                decide(attachDecision(op, { ...place, after: anchor || null }));
                setEditing(false);
              }}
            >
              Save edit
            </button>
            <button type="button" className={`${button} bg-slate-400 hover:bg-slate-500`} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
