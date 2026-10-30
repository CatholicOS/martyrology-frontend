"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import MentionPopup from "@/components/markup/MentionPopup";
import { usePrefetchEntities } from "@/lib/entities-client";
import { mentionQids, type PlacedMention } from "@/lib/mentions";
import type { ElogiumOut } from "@/lib/types";

/** How long the pointer rests on a mention before its popup opens, and how long after it leaves before it closes. */
export const OPEN_MS = 300;
export const CLOSE_MS = 200;

/** A mention and the edition it is printed in. */
export interface MarkupTarget {
  mention: PlacedMention;
  edition: string;
}

/** The reader's page: its edition and the one it is compared with, where a popup's links to other days go. */
export interface ReaderPage {
  edition: string;
  with: string | null;
}

/** The open popup: its mention, the piece it sits beside, whether a click pinned it and whether the keyboard did. */
export interface OpenPopup {
  target: MarkupTarget;
  anchor: HTMLElement;
  pinned: boolean;
  keyboard: boolean;
}

export interface MarkupApi {
  /** The groups of marks tinted (a mention's `groups`): open, hovered or focused; empty when none is. */
  active: string[];
  open: OpenPopup | null;
  hoverStart(t: MarkupTarget, anchor: HTMLElement): void;
  hoverEnd(): void;
  /** Pins the mention's popup, or unpins it when it is the one pinned. */
  pin(t: MarkupTarget, anchor: HTMLElement, keyboard: boolean): void;
  focus(groups: string[] | null): void;
}

const Ctx = createContext<MarkupApi | null>(null);

/** The markup's state, or null while "Names & places" is off (or outside the reader): then nothing is marked. */
export function useMarkup(): MarkupApi | null {
  return useContext(Ctx);
}

/** A mention's first piece, the one that takes the focus. */
function firstPiece(key: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>("[data-mention][tabindex]")].find((n) => n.dataset.mention === key);
}

/**
 * The reader's markup: whether it is on, which mention is tinted, and the one popup (in a portal). `langs` gives
 * each edition's language, for the printed words in a place popup; `page` the reader's page, for a person popup's
 * links to other eulogies. Each day's view mounts its own provider, so a
 * new day starts with no popup; switching the markup off forgets the popup, and back on does not bring it back.
 */
export function MarkupProvider({ on, langs, page, children }: {
  on: boolean; langs: Record<string, string>; page: ReaderPage; children: ReactNode;
}) {
  const [open, setOpen] = useState<OpenPopup | null>(null);
  const [hovered, setHovered] = useState<string[] | null>(null);
  const [focused, setFocused] = useState<string[] | null>(null);
  const [wasOn, setWasOn] = useState(on);
  const popupRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // The switch moved: whatever was open, hovered or focused belongs to marks that have gone (or were not there).
  if (wasOn !== on) {
    setWasOn(on);
    setOpen(null);
    setHovered(null);
    setFocused(null);
  }
  // Off: no hover may open a popup later.
  useEffect(() => {
    if (!on) window.clearTimeout(timer.current);
  }, [on]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const later = useCallback((ms: number, f: () => void) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(f, ms);
  }, []);
  const show = useCallback((o: OpenPopup) => {
    window.clearTimeout(timer.current);
    setOpen(o);
  }, []);
  /** Closes the popup, giving the focus back to its mention when it was inside the popup. */
  const close = useCallback((o: OpenPopup) => {
    window.clearTimeout(timer.current);
    const inside = popupRef.current?.contains(document.activeElement) ?? false;
    setOpen(null);
    if (inside) firstPiece(o.target.mention.key)?.focus();
  }, []);

  // Escape closes; so does a click outside the popup and its mention.
  useEffect(() => {
    if (!open) return;
    const key = open.target.mention.key;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(open);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Node && popupRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest<HTMLElement>("[data-mention]")?.dataset.mention === key) return;
      close(open);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);

  const api = useMemo<MarkupApi>(() => ({
    active: open?.target.mention.groups ?? hovered ?? focused ?? [],
    open,
    hoverStart(t, anchor) {
      setHovered(t.mention.groups);
      if (open?.pinned) return;
      if (open?.target.mention.key === t.mention.key) {
        window.clearTimeout(timer.current);
        return;
      }
      // A pin made while waiting wins over the hover.
      later(OPEN_MS, () => setOpen((o) => (o?.pinned ? o : { target: t, anchor, pinned: false, keyboard: false })));
    },
    hoverEnd() {
      setHovered(null);
      if (open?.pinned) return;
      later(CLOSE_MS, () => setOpen((o) => (o?.pinned ? o : null)));
    },
    pin(t, anchor, keyboard) {
      if (open?.pinned && open.target.mention.key === t.mention.key) close(open);
      else show({ target: t, anchor, pinned: true, keyboard });
    },
    focus: setFocused,
  }), [open, hovered, focused, later, show, close]);

  return (
    <Ctx.Provider value={on ? api : null}>
      {children}
      {on && open &&
        createPortal(
          <MentionPopup
            ref={popupRef}
            open={open}
            lang={langs[open.target.edition]}
            page={page}
            onEnter={() => window.clearTimeout(timer.current)}
            onLeave={api.hoverEnd}
          />,
          document.body,
        )}
    </Ctx.Provider>
  );
}

/** While the markup is on, asks at once for the details of every item a page's eulogies name. */
export function PrefetchEntities({ elogia }: { elogia: (Pick<ElogiumOut, "mentions"> | null)[] }) {
  usePrefetchEntities(mentionQids(elogia), useMarkup() !== null);
  return null;
}
