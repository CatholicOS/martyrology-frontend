import { getLocale, getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { auth, signIn } from "@/auth";
import { AuthStatusView } from "@/components/AuthStatusView";
import { SignOutButton } from "@/components/SignOutButton";
import { SignInReturnPath } from "@/components/SignInReturnPath";
import { describeError } from "@/lib/describe-error";
import { safeReturnPath } from "@/lib/return-path";

const buttonClass =
  "rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700";

export async function AuthStatus() {
  const t = await getTranslations("Auth");
  const locale = await getLocale();
  // Never let an auth backend problem blank the header on every page.
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    // Re-throw Next's internal dynamic-rendering/prerender signals (auth()
    // reads headers/cookies); swallowing them would leave pages prerendered
    // with a permanent "Sign in" header.
    unstable_rethrow(err);
    console.warn(`[AuthStatus] could not read the session; rendering signed out (${describeError(err)})`);
    session = null;
  }

  const signInButton = (
    <form
      action={async (formData: FormData) => {
        "use server";
        // Come back to the page the reader was on, in its language; the field is
        // client-supplied, so it is validated (same-origin, locale-prefixed) here.
        await signIn("zitadel", { redirectTo: safeReturnPath(formData.get("redirectTo"), locale) });
      }}
    >
      <SignInReturnPath fallback={`/${locale}`} />
      <button type="submit" className={buttonClass}>
        {t("signIn")}
      </button>
    </form>
  );

  const signOutButton = <SignOutButton className={buttonClass} />;

  return (
    <AuthStatusView
      email={session?.user?.email}
      error={session?.error}
      onSignIn={signInButton}
      onSignOut={signOutButton}
    />
  );
}
