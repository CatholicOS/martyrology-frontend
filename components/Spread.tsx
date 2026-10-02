"use client";

import Link from "next/link";
import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import DayPage, { Conclusio } from "@/components/DayPage";
import DayStatus from "@/components/DayStatus";
import Eulogy from "@/components/Eulogy";
import styles from "@/components/page.module.css";
import { dateHeading, dayPath, monthName, type Day, type Lang } from "@/lib/calendar";
import { editionLang, editionTitle, languageLabel, shortName, titleCase, yearAndLanguage } from "@/lib/editions";
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

function sideInfo(id: string, otherId: string, editions: EditionOut[]): SideInfo {
  const meta = editions.find((e) => e.edition_id === id);
  const other = editions.find((e) => e.edition_id === otherId);
  const title = meta ? `${titleCase(editionTitle(meta))} ${meta.year}` : id;
  return {
    id,
    meta,
    lang: meta ? editionLang(meta) : "la",
    title,
    caption: meta ? `${title} · ${languageLabel(meta)}` : id,
    name: meta && other ? shortName(meta, other) : id,
  };
}

/** The editorial note on the empty side of a one-sided row, set like the misprint notes. */
function Gap({ note, name, href }: { note: GapNote; name: string; href: (d: Day) => string }) {
  const n = (entry: number | null) => (entry === null ? "" : `, n. ${entry}`);
  let body: ReactNode;
  switch (note.kind) {
    case "absent":
      body = <><i>not in</i> {name}</>;
      break;
    case "pending":
      body = <><i>not on this day in</i> {name}</>;
      break;
    case "moved":
      body = <><i>{name}:</i> {note.entry === null ? "" : `n. ${note.entry}, `}{note.direction}</>;
      break;
    case "elsewhere":
      body = (
        <>
          <i>{name}:</i>{" "}
          <Link href={href(note.day)}>
            {note.day.dd} {monthName(note.day.mm, "en")}{n(note.entry)} →
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
 * each sheet is a page of its own.
 */
export default function Spread({
  a, b, editions, mm, dd, signedIn,
}: {
  a: string; b: string; editions: EditionOut[]; mm: number; dd: number; signedIn: boolean;
}) {
  const day = useMemo<Day>(() => ({ mm, dd }), [mm, dd]);
  const A = sideInfo(a, b, editions);
  const B = sideInfo(b, a, editions);
  const dayA = useDay(a, mm, dd);
  const dayB = useDay(b, mm, dd);
  const sa = dayA.state;
  const sb = dayB.state;
  const aligned = A.meta?.aligned !== false && B.meta?.aligned !== false;

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
  const href = (d: Day) => dayPath(a, d, b);

  const unaligned = [A, B].filter((s) => s.meta?.aligned === false);
  const notice = unaligned.map((s) => (
    <p key={s.id} className="mb-3 text-center text-sm text-slate-600 dark:text-slate-400">
      The {yearAndLanguage(s.meta!)} edition is not yet aligned, so its eulogies are not matched.
    </p>
  ));

  if (!rows || sa.kind !== "ready" || sb.kind !== "ready") {
    const page = (s: SideInfo, d: typeof dayA) =>
      d.state.kind === "ready" ? (
        <DayPage day={d.state.day} heading={dateHeading(day, s.lang)} lang={s.lang} edition={s.id} />
      ) : (
        <DayStatus state={d.state} retry={d.retry} title={s.title} signedIn={signedIn} mm={mm} dd={dd} />
      );
    return (
      <>
        {notice}
        <div className={styles.facing}>
          <div>{page(A, dayA)}</div>
          <div>{page(B, dayB)}</div>
        </div>
      </>
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
          <h2 className={styles.heading}>{d.titulus || dateHeading(day, s.lang)}</h2>
          <p className={styles.caption}>{s.caption}</p>
        </>
      );
    }
    if (r.kind === "conclusio") return d.conclusio ? <Conclusio text={d.conclusio} /> : null;
    const e = r[side];
    if (e) return <Eulogy e={e} edition={s.id} />;
    const note = gapNote(rows, i, s.id, placements, day);
    return note ? <Gap note={note} name={s.name} href={href} /> : null;
  };

  return (
    <>
      {notice}
      <div className={styles.spread} style={{ "--rows": rows.length } as CSSProperties}>
        <div className={`${styles.sheet} ${styles.sheetA}`} aria-hidden />
        <div className={`${styles.sheet} ${styles.sheetB}`} aria-hidden />
        {rows.map((r, i) => {
          const edge = i === 0 ? styles.first : i === rows.length - 1 ? styles.last : "";
          const style = { "--row": i + 1 } as CSSProperties;
          return (
            <Fragment key={i}>
              <div className={`${styles.cellA} ${edge}`} style={style} data-row={i + 1} data-side="a" lang={A.lang}>
                {cell(r, i, "a")}
              </div>
              <div className={`${styles.cellB} ${edge}`} style={style} data-row={i + 1} data-side="b" lang={B.lang}>
                {r.kind === "eulogy" && <span className={styles.tag}>{B.name}</span>}
                {cell(r, i, "b")}
              </div>
            </Fragment>
          );
        })}
      </div>
    </>
  );
}
