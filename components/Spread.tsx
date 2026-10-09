"use client";

import { Link } from "@/i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import DayPage, { Conclusio, DayTitle, Rubricae } from "@/components/DayPage";
import CuratorNotes from "@/components/CuratorNotes";
import DayStatus from "@/components/DayStatus";
import Eulogy from "@/components/Eulogy";
import { MarkupProvider, PrefetchEntities } from "@/components/markup/Markup";
import styles from "@/components/page.module.css";
import PrintedFootnotes from "@/components/PrintedFootnotes";
import { dateHeading, dayPath, interfaceMonth, type Day, type Lang } from "@/lib/calendar";
import { editionLang, editionTitle, type BookshelfT, languageLabel, shortName, titleCase, yearAndLanguage } from "@/lib/editions";
import { pageFootnotes } from "@/lib/footnotes";
import { hasMentions } from "@/lib/mentions";
import { pageNotes } from "@/lib/notes";
import { buildRows, gapNote, type GapNote, type Row } from "@/lib/parallel";
import type { EditionOut } from "@/lib/types";
import { useDay } from "@/lib/use-day";
import { usePlacements } from "@/lib/use-placements";

interface SideInfo {
  id: string;
  meta: EditionOut | undefined;
  lang: Lang;
  /** "Martyrologium Romanum 1749", for notices. */
  title: string;
  /** "Martyrologium Romanum 1749 · Latin", under the heading. */
  caption: string;
  /** "1749" or "2004 Italian", in gap notes and phone tags. */
  name: string;
}

function sideInfo(t: BookshelfT, id: string, otherId: string, editions: EditionOut[]): SideInfo {
  const meta = editions.find((e) => e.edition_id === id);
  const other = editions.find((e) => e.edition_id === otherId);
  const title = meta ? `${titleCase(editionTitle(meta))} ${meta.year}` : id;
  return {
    id,
    meta,
    lang: meta ? editionLang(meta) : "la",
    title,
    caption: meta ? `${title} · ${languageLabel(t, meta)}` : id,
    name: meta && other ? shortName(t, meta, other) : id,
  };
}

/** The editorial note on the empty side of a one-sided row, set like the misprint notes. */
function Gap({ note, name, href }: { note: GapNote; name: string; href: (d: Day) => string }) {
  const t = useTranslations("Reader");
  const format = useFormatter();
  const i = (c: ReactNode) => <i>{c}</i>;
  const star = note.kind === "moved" || note.kind === "elsewhere" ? (note.asterisk ? "*" : "") : "";
  const n = (entry: number | null) => (entry === null ? "" : `, ${t("gapEntry", { entry: `${entry}${star}` })}`);
  let body: ReactNode;
  switch (note.kind) {
    case "absent":
      body = t.rich("gapAbsent", { name, i });
      break;
    case "pending":
      body = t.rich("gapPending", { name, i });
      break;
    case "moved":
      body = <><i>{name}:</i> {note.entry === null ? "" : `${t("gapEntry", { entry: `${note.entry}${star}` })}, `}{t(note.direction === "above" ? "gapAbove" : "gapBelow")}</>;
      break;
    case "elsewhere":
      body = (
        <>
          <i>{name}:</i>{" "}
          <Link href={href(note.day)}>
            {note.day.dd} {interfaceMonth(format, note.day.mm)}{n(note.entry)} →
          </Link>
        </>
      );
      break;
  }
  return <p className={styles.gap}>[{body}]</p>;
}

/**
 * One day of two editions as two facing sheets. When both days are ready and both editions are
 * aligned to canonical ids, eulogies are set row by row, each level with its counterpart; otherwise
 * each sheet is a page of its own. The markup's provider is mounted here, so a spread keyed per day starts
 * each day with no popup open.
 */
export default function Spread({
  a, b, editions, mm, dd, signedIn, turn, showIds = false, onMentions, markup = false,
}: {
  a: string; b: string; editions: EditionOut[]; mm: number; dd: number; signedIn: boolean;
  /** Set each eulogy's canonical id above it. */
  showIds?: boolean;
  /** The page-turn animation to play once both days have settled. */
  turn: "next" | "prev" | null;
  /** Told whether either sheet names anyone or anywhere. */
  onMentions?: (has: boolean) => void;
  /** Mark the persons and places the sheets name ("Names & places"). */
  markup?: boolean;
}) {
  const tShelf = useTranslations("Bookshelf");
  const t = useTranslations("Reader");
  const day = useMemo<Day>(() => ({ mm, dd }), [mm, dd]);
  const A = sideInfo(tShelf, a, b, editions);
  const B = sideInfo(tShelf, b, a, editions);
  const dayA = useDay(a, mm, dd);
  const dayB = useDay(b, mm, dd);
  const sa = dayA.state;
  const sb = dayB.state;
  useEffect(() => {
    const elogia = [...(sa.kind === "ready" ? sa.day.elogia : []), ...(sb.kind === "ready" ? sb.day.elogia : [])];
    onMentions?.(hasMentions(elogia));
  }, [sa, sb, onMentions]);
  // Rows only once both editions are known to be aligned; unknown metadata shows independent pages.
  const aligned = !!A.meta && !!B.meta && A.meta.aligned !== false && B.meta.aligned !== false;
  const turnClass = turn === "next" ? styles.turnNext : turn === "prev" ? styles.turnPrev : undefined;

  const rows = useMemo<Row[] | null>(
    () => (aligned && sa.kind === "ready" && sb.kind === "ready" ? buildRows(sa.day.elogia, sb.day.elogia) : null),
    [aligned, sa, sb],
  );
  const oneSided = useMemo(
    () =>
      (rows ?? []).flatMap((r) =>
        r.kind === "eulogy" && !(r.a && r.b) && r.counterpart === null && (r.a ?? r.b)?.id ? [(r.a ?? r.b)!.id!] : [],
      ),
    [rows],
  );
  const placements = usePlacements(oneSided);
  // Each sheet marks its own curators' notes (†, ††, … down the sheet) and its edition's footnotes.
  const notes = useMemo(() => {
    const ids = (s: "a" | "b") => (rows ?? []).map((r) => (r.kind === "eulogy" ? (r[s] ?? null) : null));
    const side = (s: "a" | "b", id: string) => ({
      curators: showIds ? pageNotes(ids(s).map((e) => e?.id ?? null), id) : [],
      printed: pageFootnotes(ids(s), id),
    });
    return { a: side("a", a), b: side("b", b) };
  }, [rows, showIds, a, b]);
  const href = (d: Day) => dayPath(a, d, b);
  // Each sheet's language, for the printed words in a place popup.
  const marked = (ui: ReactNode) => (
    <MarkupProvider on={markup} langs={{ [a]: A.lang, [b]: B.lang }}>{ui}</MarkupProvider>
  );

  const unaligned = [A, B].filter((s) => s.meta?.aligned === false);
  const notice = unaligned.map((s) => (
    <p key={s.id} className="mb-3 text-center text-sm text-slate-600 dark:text-slate-400">
      {t("unaligned", { edition: yearAndLanguage(tShelf, s.meta!) })}
    </p>
  ));

  if (sa.kind === "loading" || sb.kind === "loading") {
    // A ready side waits as a placeholder, so both sheets appear (and turn) together;
    // a side that settled locked, without text or failed shows its notice at once.
    const waiting = (s: SideInfo, d: typeof dayA) => (
      <DayStatus
        state={d.state.kind === "ready" ? { kind: "loading" } : d.state}
        retry={d.retry}
        title={s.title}
        signedIn={signedIn}
        mm={mm}
        dd={dd}
      />
    );
    return marked(
      <div className={styles.facing}>
        {waiting(A, dayA)}
        {waiting(B, dayB)}
      </div>,
    );
  }

  if (!rows || sa.kind !== "ready" || sb.kind !== "ready") {
    const page = (s: SideInfo, d: typeof dayA) =>
      d.state.kind === "ready" ? (
        <DayPage day={d.state.day} heading={dateHeading(day, s.lang)} lang={s.lang} edition={s.id} showIds={showIds} />
      ) : (
        <DayStatus state={d.state} retry={d.retry} title={s.title} signedIn={signedIn} mm={mm} dd={dd} />
      );
    return marked(
      <div className={turnClass}>
        {notice}
        <div className={styles.facing}>
          <div>{page(A, dayA)}</div>
          <div>{page(B, dayB)}</div>
        </div>
      </div>,
    );
  }

  const days = { a: sa.day, b: sb.day };
  const info = { a: A, b: B };
  const cell = (r: Row, i: number, side: "a" | "b"): ReactNode => {
    const s = info[side];
    const d = days[side];
    if (r.kind === "titulus") {
      return (
        <>
          <DayTitle day={d} heading={dateHeading(day, s.lang)} edition={s.id} />
          <p className={styles.caption}>{s.caption}</p>
          <Rubricae day={d} after={null} />
        </>
      );
    }
    if (r.kind === "conclusio") {
      const n = notes[side];
      if (!d.conclusio && n.curators.length === 0 && n.printed.length === 0) return null;
      return (
        <>
          {d.conclusio && <Conclusio text={d.conclusio} />}
          <PrintedFootnotes notes={n.printed} lang={s.lang} edition={s.id} />
          <CuratorNotes notes={n.curators} edition={s.id} />
        </>
      );
    }
    const e = r[side];
    const note = e ? null : gapNote(rows, i, s.id, placements, day);
    if (!e && !note) return null;
    // The edition's name labels the cell: visible on phones for B, otherwise for screen readers only.
    return (
      <>
        <span className={side === "b" ? styles.tag : styles.srOnly}>{s.name}</span>
        {e ? (
          <Eulogy
            e={e}
            edition={s.id}
            showId={showIds}
            note={notes[side].curators.find((n) => n.at === i)}
            footnotes={notes[side].printed.filter((f) => f.at === i)}
          />
        ) : (
          <Gap note={note!} name={s.name} href={href} />
        )}
        {e?.id && <Rubricae day={d} after={e.id} />}
      </>
    );
  };

  return marked(
    <div className={turnClass}>
      {notice}
      <div className={styles.spread} style={{ "--rows": rows.length } as CSSProperties}>
        <PrefetchEntities elogia={[...days.a.elogia, ...days.b.elogia]} />
        <div className={`${styles.sheet} ${styles.sheetA}`} aria-hidden />
        <div className={`${styles.sheet} ${styles.sheetB}`} aria-hidden />
        {rows.map((r, i) => {
          const edge = i === 0 ? styles.first : i === rows.length - 1 ? styles.last : "";
          const style = { "--row": i + 1 } as CSSProperties;
          const cellA = cell(r, i, "a");
          const cellB = cell(r, i, "b");
          return (
            <Fragment key={i}>
              <div className={`${styles.cellA} ${edge}`} style={style} data-row={i + 1} data-side="a" lang={A.lang}>
                {cellA}
              </div>
              <div className={`${styles.cellB} ${cellB ? styles.ruled : ""} ${edge}`} style={style} data-row={i + 1} data-side="b" lang={B.lang}>
                {cellB}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>,
  );
}
