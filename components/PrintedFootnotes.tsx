import { Fragment, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useMarkup } from "@/components/markup/Markup";
import { MentionRun, MentionText } from "@/components/markup/MentionPiece";
import styles from "@/components/page.module.css";
import type { PageFootnote } from "@/lib/footnotes";
import { mentionsIn } from "@/lib/mentions";
import { footnoteMisprintsFor, splitMisprints } from "@/lib/misprints";

/** Notes the edition prints in the margin, set apart as side-notes. */
export function MarginNotes({ notes }: { notes: string[] }) {
  const t = useTranslations("Reader");
  return (
    <span className={styles.marginNotes} role="note" aria-label={t("inMargin")}>
      {notes.map((t, i) => (
        <span key={i} className={styles.marginNote}>
          {t}
        </span>
      ))}
    </span>
  );
}

/** A printed footnote's mark in the text, as printed and in the text's colour, linked to the footnote. */
export function FootnoteMark({ note }: { note: PageFootnote }) {
  const t = useTranslations("Reader");
  return (
    <a id={note.markAnchor} href={`#${note.anchor}`} className={styles.fnMark} aria-label={t("footnote", { mark: note.mark })}>
      {note.mark}
    </a>
  );
}

/**
 * A footnote's text as printed, its persons and places marked while "Names & places" is on, with
 * `[sic! expected: …]` after each verified misprint, as in the eulogy's text.
 */
function FootnoteText({ note, edition }: { note: PageFootnote; edition: string }) {
  const t = useTranslations("Reader");
  const on = useMarkup() !== null;
  const where = note.number ?? 0;
  const placed = useMemo(
    () => (on ? mentionsIn(note.mentions, where, edition, note.id, note.text.length) : []),
    [on, note.mentions, where, edition, note.id, note.text.length],
  );
  const misprints = footnoteMisprintsFor(edition, note.id, where);
  if (misprints.length === 0) {
    return <MentionText text={note.text} mentions={note.mentions} where={where} eulogy={note.id} edition={edition} />;
  }
  // Each run's span of the text, so its mentions are cut where a misprint's note goes.
  const runs: { intended?: string; from: number; to: number }[] = [];
  let pos = 0;
  for (const s of splitMisprints(note.text, misprints)) {
    runs.push({ intended: s.intended, from: pos, to: pos + s.text.length });
    pos += s.text.length;
  }
  return (
    <>
      {runs.map((r, i) => (
        <Fragment key={i}>
          <MentionRun text={note.text} from={r.from} to={r.to} mentions={placed} edition={edition} />
          {r.intended && (
            <span style={{ fontStyle: "normal" }}>
              {" "}[{t.rich("sic", { intended: r.intended, i: (c) => <i>{c}</i> })}]
            </span>
          )}
        </Fragment>
      ))}
    </>
  );
}

/**
 * The edition's own footnotes at the foot of the page, each linked back to its mark, with the notes
 * the edition prints in the margin beside it (beside the note on wide screens, under it on phones).
 * `edition` (a CLBDR edition id) names the edition the persons and places marked in the footnotes are printed in.
 */
export default function PrintedFootnotes({ notes, lang, edition = "" }: { notes: PageFootnote[]; lang?: string; edition?: string }) {
  const t = useTranslations("Reader");
  if (notes.length === 0) return null;
  return (
    <aside className={styles.footnotes} lang={lang} aria-label={t("footnotes")}>
      <ul>
        {notes.map((n) => (
          <li key={n.anchor} id={n.anchor} className={n.marginalia.length ? styles.withMargin : undefined}>
            <a href={`#${n.markAnchor}`} className={styles.fnMark} aria-label={t("backToFootnote", { mark: n.mark })}>
              {n.mark}
            </a>
            <span>
              <FootnoteText note={n} edition={edition} />
            </span>
            {n.marginalia.length > 0 && <MarginNotes notes={n.marginalia} />}
          </li>
        ))}
      </ul>
    </aside>
  );
}
