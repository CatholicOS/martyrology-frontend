"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * The header's navigation. From the `sm` breakpoint up its items sit in a row; below it a
 * hamburger button opens them as a vertical panel, the sign-in/out controls included. The
 * items are rendered once, so a server action inside them (sign-in) exists only once.
 * The panel closes on Escape, on a click outside, on following one of its links, on a
 * navigation to another page, and on Back/Forward.
 */
export function NavMenu({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // A navigation to another page closes the panel, including a return to the page it was
  // opened on: reset while rendering, when the pathname changes (React's pattern for state
  // that follows a value; no effect needed). Query-only navigations are covered elsewhere:
  // from the page they need a click outside the panel, which closes it; Back/Forward fire
  // popstate (below).
  const [shownFor, setShownFor] = useState(pathname);
  if (pathname !== shownFor) {
    setShownFor(pathname);
    setOpen(false);
  }
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onPopState = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("popstate", onPopState);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="rounded p-2 text-slate-700 hover:bg-slate-100 sm:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <nav
        id={panelId}
        aria-label="Main"
        // Following a link closes the panel at once, before the navigation completes.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`${open ? "flex" : "hidden"} absolute right-0 top-full z-50 mt-2 min-w-48 flex-col items-stretch gap-3 rounded border border-slate-200 bg-white p-4 text-sm shadow-lg dark:border-slate-800 dark:bg-slate-950 sm:static sm:mt-0 sm:flex sm:min-w-0 sm:flex-row sm:items-center sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:dark:bg-transparent`}
      >
        {children}
      </nav>
    </div>
  );
}
