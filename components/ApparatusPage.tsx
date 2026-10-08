"use client";

import { Link } from "@/i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import EulogyText from "@/components/EulogyText";
import styles from "@/components/page.module.css";
import { getEditions, getMonth } from "@/lib/api";
import { apparatus, count, only, type ApparatusEntry, type ApparatusKind } from "@/lib/apparatus";
import { dayPath, interfaceMonth, pad2 } from "@/lib/calendar";
import { erratumPlace } from "@/lib/errata";
import { editionLang, editionTitle } from "@/lib/editions";
import { noteParts } from "@/lib/note-links";
import { getSnapshot } from "@/lib/snapshot";
import type { EditionOut } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; entries: ApparatusEntry[]; meta: EditionOut | null; restricted: boolean; accessInfo: string | null };

const KINDS: ApparatusKind[] = ["notes", "misprints", "errata"];

/** A eulogy's printed number and asterisk as this edition prints them ("3*."), as a rubric. */
function Number({ e }: { e: ApparatusEntry }) {
  return (
    <span className={styles.rubric}>
      {e.entry}
      {e.asterisk ? "*" : ""}.
    </span>
  );
}

/**
 * An edition's whole apparatus on one page: every eulogy with a curator's note, a misprint the
 * curators verified, or a correction the edition prints in its own errata, in printed order, with
 * the eulogy's text as printed (misprints and errata marked in place) and a link to its day.
 */
export default function ApparatusPage({ edition }: { edition: string }) {
  const t = useTranslations("Notes");
  const tReader = useTranslations("Reader");
  const format = useFormatter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [shown, setShown] = useState<Set<ApparatusKind>>(new Set(KINDS));

  useEffect(() => {
    let cancelled = false;
    const months = Array.from({ length: 12 }, (_, i) => getMonth(edition, pad2(i + 1)));
    Promise.all([getEditions(), Promise.all(months)]).then(
      ([editions, ms]) => {
        if (cancelled) return;
        const locked = ms.find((m) => m.metadata.access === "restricted-texts");
        setState({
          kind: "ready",
          entries: apparatus(edition, ms),
          meta: editions.find((e) => e.edition_id === edition) ?? null,
          restricted: Boolean(locked),
          accessInfo: locked?.metadata.access_info ?? null,
        });
      },
      () => !cancelled && setState({ kind: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [edition]);

  const visible = useMemo(() => (state.kind === "ready" ? only(state.entries, shown) : []), [state, shown]);
  if (state.kind === "loading") return <p className="p-6 text-center text-slate-600">{t("loading")}</p>;
  if (state.kind === "error") return <p className="p-6 text-center text-red-700">{t("loadError")}</p>;

  const lang = state.meta ? editionLang(state.meta) : "la";
  const title = state.meta ? `${editionTitle(state.meta)} ${state.meta.year}` : edition;
  const snap = getSnapshot();
  const byMonth = new Map<number, ApparatusEntry[]>();
  for (const e of visible) byMonth.set(e.mm, [...(byMonth.get(e.mm) ?? []), e]);

  return (
    <article className={styles.page} aria-labelledby="apparatus-title">
      <h1 id="apparatus-title" className={styles.heading}>
        {t("title", { title })}
      </h1>
      <p className="mb-3 text-center text-sm text-slate-600">
        <Link href={`/read/${encodeURIComponent(edition)}`} className="underline">
          {t("readEdition")}
        </Link>
      </p>
      <fieldset className="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm" aria-label={t("show")}>
        {KINDS.map((key) => {
          const n = count(state.entries, key);
          return (
            <label key={key} className={n ? "" : "opacity-50"}>
              <input
                type="checkbox"
                className="mr-1"
                disabled={!n}
                checked={shown.has(key)}
                onChange={(ev) => {
                  const next = new Set(shown);
                  if (ev.target.checked) next.add(key);
                  else next.delete(key);
                  setShown(next);
                }}
              />
              {t(`kind.${key}`)} ({n})
            </label>
          );
        })}
      </fieldset>
      {state.restricted && (
        <p className="mb-4 text-center text-sm text-slate-600">
          {t("restricted")}
          {state.accessInfo && (
            <>
              {" "}
              <a href={state.accessInfo} className="underline">
                {t("howToAccess")}
              </a>
            </>
          )}
        </p>
      )}
      {visible.length === 0 && <p className="text-center text-slate-600">{t("nothing")}</p>}
      {[...byMonth.entries()].map(([mm, entries]) => (
        <section key={mm} aria-label={interfaceMonth(format, mm)}>
          <h2 className={`${styles.heading} mt-6`}>{interfaceMonth(format, mm)}</h2>
          <ul>
            {entries.map((e) => (
              <li key={e.id} id={e.id} className="mb-5">
                <p className="text-sm">
                  <Link href={`${dayPath(edition, { mm: e.mm, dd: e.dd })}#${e.id}`} className="underline">
                    {e.dd} {interfaceMonth(format, e.mm)}
                  </Link>
                  {/* Without the text (no access), the printed number still shows here. */}
                  {!e.text && e.entry !== null && (
                    <>
                      {" "}· <Number e={e} />
                    </>
                  )}
                  {snap[e.id] && <> · {snap[e.id].subject[lang]}</>}
                  <span className={styles.idHint} style={{ display: "inline", margin: "0 0 0 0.6em" }}>
                    {e.id}
                  </span>
                </p>
                {e.text && (
                  <p className={e.unnumbered ? `${styles.entry} ${styles.unnumbered}` : styles.entry} lang={lang}>
                    {e.entry !== null && !e.unnumbered && <Number e={e} />}
                    <EulogyText
                      text={e.text} id={e.id} edition={edition} noteClassName={styles.sic}
                      errata={e.errata} errataClassName={styles.errata}
                    />
                  </p>
                )}
                <ul className="text-sm leading-snug">
                  {shown.has("notes") &&
                    e.notes.map((n, i) => (
                      <li key={`n${i}`} lang="en">
                        <span className={styles.noteMark}>†</span>{" "}
                        {noteParts(n, edition).map((p, k) =>
                          p.href ? (
                            <Link key={k} href={p.href} className="underline">
                              {p.text}
                            </Link>
                          ) : (
                            <span key={k}>{p.text}</span>
                          ),
                        )}
                      </li>
                    ))}
                  {shown.has("misprints") &&
                    e.misprints.map((m, i) => (
                      <li key={`m${i}`} className={styles.sic}>
                        {t.rich("misprint", {
                          printed: m.printed,
                          intended: m.intended,
                          text: (c) => <span lang={lang}>{c}</span>,
                          i: (c) => <i>{c}</i>,
                        })}
                      </li>
                    ))}
                  {shown.has("errata") &&
                    e.errata.map((x, i) => (
                      <li key={`e${i}`} className={styles.errata}>
                        {t.rich("erratum", {
                          place: erratumPlace(tReader, x.ref),
                          entry: x.entry,
                          text: (c) => <span lang={lang}>{c}</span>,
                          sc: (c) => <span style={{ fontVariant: "small-caps" }}>{c}</span>,
                        })}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
