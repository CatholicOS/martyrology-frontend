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
    const input = ref.current;
    const form = input?.form;
    if (!input || !form) return;
    // The layout (and so this field) survives soft navigations, so read the location
    // when the form is submitted, not just on mount. A native listener on the form
    // runs before React's delegated form-action handler builds the FormData.
    const fill = () => {
      input.value = window.location.pathname + window.location.search;
    };
    fill();
    form.addEventListener("submit", fill);
    return () => form.removeEventListener("submit", fill);
  }, []);
  return <input ref={ref} type="hidden" name="redirectTo" defaultValue={fallback} />;
}
