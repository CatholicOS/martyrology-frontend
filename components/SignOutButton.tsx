"use client";

import { signOut } from "next-auth/react";

/**
 * Signs out, then reloads the page. A server action's redirect back to the same page is a soft
 * navigation: the header re-renders, but client components keep what they fetched while signed
 * in (a reader's licensed texts), so only a full reload leaves nothing of the session on screen.
 */
export function SignOutButton({ className }: { className: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.reload();
      }}
    >
      Sign out
    </button>
  );
}
