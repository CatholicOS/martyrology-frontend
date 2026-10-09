"use client";

import { Fragment, useMemo, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useMarkup, type MarkupApi } from "@/components/markup/Markup";
import styles from "@/components/page.module.css";
import { mentionsIn, splitByMentions, type PlacedMention } from "@/lib/mentions";
import type { Mention } from "@/lib/types";

/**
 * One piece of a mention (a footnote mark or an erratum can cut a mention in two): every piece hovers, tints and
 * opens the same popup; the first is the one the keyboard reaches.
 */
function MentionPiece({ markup, mention, edition, first, children }: {
  markup: MarkupApi; mention: PlacedMention; edition: string; first: boolean; children: ReactNode;
}) {
  const t = useTranslations("Markup");
  const target = { mention, edition };
  const expanded = markup.open?.target.mention.key === mention.key;
  return (
    <span
      data-mention={mention.key}
      data-active={markup.active === mention.key ? "" : undefined}
      className={`${styles.mention} ${mention.kind === "person" ? styles.person : styles.place}`}
      onMouseEnter={(e) => markup.hoverStart(target, e.currentTarget)}
      onMouseLeave={() => markup.hoverEnd()}
      onClick={(e) => markup.pin(target, e.currentTarget, false)}
      {...(first
        ? {
            tabIndex: 0,
            role: "button",
            "aria-haspopup": "dialog" as const,
            "aria-expanded": expanded,
            "aria-roledescription": t(mention.kind),
            onFocus: () => markup.focus(mention.key),
            onBlur: () => markup.focus(null),
            onKeyDown: (e: KeyboardEvent<HTMLSpanElement>) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              markup.pin(target, e.currentTarget, true);
            },
          }
        : {})}
    >
      {children}
    </span>
  );
}

/**
 * `text` from `from` to `to`, its mentions' pieces marked; plain text when there are none, or while the markup is
 * off (or outside the reader), so the text is then exactly as it was before the markup.
 */
export function MentionRun({ text, from, to, mentions, edition }: {
  text: string; from: number; to: number; mentions: PlacedMention[]; edition: string;
}) {
  const markup = useMarkup();
  if (!markup || mentions.length === 0) return <>{text.slice(from, to)}</>;
  return (
    <>
      {splitByMentions(from, to, mentions).map((p) =>
        p.mention ? (
          <MentionPiece key={p.start} markup={markup} mention={p.mention} edition={edition} first={p.first}>
            {text.slice(p.start, p.end)}
          </MentionPiece>
        ) : (
          <Fragment key={p.start}>{text.slice(p.start, p.end)}</Fragment>
        ),
      )}
    </>
  );
}

/** A whole text (a footnote's, or a eulogy's without apparatus) with its mentions marked while the markup is on. */
export function MentionText({ text, mentions, where, eulogy, edition }: {
  text: string; mentions: Mention[] | undefined; where: "text" | number; eulogy: string; edition: string;
}) {
  const on = useMarkup() !== null;
  const placed = useMemo(
    () => (on ? mentionsIn(mentions, where, edition, eulogy, text.length) : []),
    [on, mentions, where, edition, eulogy, text.length],
  );
  return <MentionRun text={text} from={0} to={text.length} mentions={placed} edition={edition} />;
}
