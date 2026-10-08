"use client";

import { useEffect, useRef } from "react";

/**
 * Hidden form field carrying the page the reader is on, so the server-side sign-in
 * action can send them back to it. The server renders the fallback (the locale
 * home); the browser then fills in the real location. The action re-validates it.
 */
export function SignInReturnPath({ fallback }: { fallback: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = window.location.pathname + window.location.search;
  }, []);
  return <input ref={ref} type="hidden" name="redirectTo" defaultValue={fallback} />;
}
