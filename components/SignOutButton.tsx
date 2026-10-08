"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";

/**
 * Signs out, then reloads the page. A server action's redirect back to the same page is a soft
 * navigation: the header re-renders, but client components keep what they fetched while signed
 * in (a reader's licensed texts), so only a full reload leaves nothing of the session on screen.
 * It reloads only once signing out succeeded: Auth.js answers a failure with its error page's
 * URL (or the request throws), and a reload then would show the reader still signed in.
 */
export function SignOutButton({ className }: { className: string }) {
  const t = useTranslations("Auth");
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className={className}
        onClick={async () => {
          setFailed(false);
          try {
            const result = await signOut({ redirect: false });
            if (result?.url && new URL(result.url, window.location.href).pathname.endsWith("/error")) {
              setFailed(true);
              return;
            }
          } catch {
            setFailed(true);
            return;
          }
          window.location.reload();
        }}
      >
        {t("signOut")}
      </button>
      {failed && (
        <span role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t("signOutFailed")}
        </span>
      )}
    </span>
  );
}
