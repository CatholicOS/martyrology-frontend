"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * The header's navigation. From the `sm` breakpoint up its items sit in a row; below it a
 * hamburger button opens them as a vertical panel, the sign-in/out controls included. The
 * items are rendered once, so a server action inside them (sign-in) exists only once.
 * The panel closes on Escape, on a click outside, on following one of its links, and on any
 * navigation.
 */
export function NavMenu({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The page the panel was opened on: it is open only while that page is shown, so any
  // navigation (its links, or any other way the page changed) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn !== null && openOn === pathname;
  const setOpen = (o: boolean | ((prev: boolean) => boolean)) =>
    setOpenOn((prev) => {
      const wasOpen = prev !== null && prev === pathname;
      return (typeof o === "function" ? o(wasOpen) : o) ? pathname : null;
    });
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenOn(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
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
