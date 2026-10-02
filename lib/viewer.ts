import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { auth } from "@/auth";
import { describeError } from "@/lib/describe-error";

export type Viewer = { signedIn: boolean; curator: boolean };

/**
 * Who is looking, for server components: memoized per request, so the header
 * and the page share one session read. A session that cannot be read counts
 * as signed out, as in AuthStatus, so an auth problem never blanks a page.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  try {
    const session = await auth();
    return { signedIn: Boolean(session?.user), curator: session?.curator === true };
  } catch (err) {
    unstable_rethrow(err);
    console.warn(`[viewer] could not read the session; treating as signed out (${describeError(err)})`);
    return { signedIn: false, curator: false };
  }
});
