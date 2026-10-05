import { unstable_rethrow } from "next/navigation";
import { auth, signIn } from "@/auth";
import { AuthStatusView } from "@/components/AuthStatusView";
import { SignOutButton } from "@/components/SignOutButton";
import { describeError } from "@/lib/describe-error";

const buttonClass =
  "rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700";

export async function AuthStatus() {
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
      action={async () => {
        "use server";
        await signIn("zitadel");
      }}
    >
      <button type="submit" className={buttonClass}>
        Sign in
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
