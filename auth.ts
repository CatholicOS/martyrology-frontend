import NextAuth, { type NextAuthConfig } from "next-auth";
import Zitadel from "next-auth/providers/zitadel";
import type { ZitadelToken } from "@/lib/zitadel-token";

// Exported so the callbacks can be unit tested without booting a provider.
// The test that matters asserts the access token never reaches the Session —
// see lib/__tests__/auth-callbacks.test.ts. Auth.js serves whatever the session
// callback returns as the body of GET /api/auth/session, so that property is a
// security boundary, not a style choice, and it needs a permanent guard.
export const callbacks = {
  async jwt({ token, account }) {
    // Initial sign-in: account is present exactly once.
    if (account) {
      return {
        ...token,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
      };
    }
    // Deliberately no refresh here. This callback also runs under auth() in
    // Server Components (the header renders it on every page), and there
    // Auth.js throws away the Set-Cookie: a refresh would spend Zitadel's
    // rotating refresh token and keep nothing. The /api/mr route is the
    // access token's only consumer and, as a Route Handler, can persist the
    // refreshed cookie, so the refresh lives there (lib/session-token.ts).
    return token;
  },
  async session({ session, token }) {
    // NEVER put the access token here. Auth.js sets the session callback's
    // return value as the response body of GET /api/auth/session
    // (packages/core/src/lib/actions/session.ts: `response.body = newSession`),
    // so anything on the session is readable by the browser. Putting the
    // token here would hand out exactly what the BFF exists to withhold.
    // The proxy reads it from the JWT server-side instead — see Task 4.
    //
    // `error` is safe: it is a string like "RefreshAccessTokenError", and
    // the header needs it to tell the curator to sign in again.
    const current = token as ZitadelToken;
    session.error = current.error;
    return session;
  },
} satisfies NonNullable<NextAuthConfig["callbacks"]>;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Zitadel({
      issuer: process.env.AUTH_ZITADEL_ISSUER,
      clientId: process.env.AUTH_ZITADEL_ID,
      clientSecret: process.env.AUTH_ZITADEL_SECRET,
      // offline_access is what makes Zitadel return a refresh token; without
      // it the curator is logged out when the access token expires.
      //
      // prompt=select_account makes Zitadel show its account picker even
      // while its own SSO session is alive, so "Sign in" after "Sign out"
      // (which ends only this app's session) can choose a different account.
      authorization: {
        params: { scope: "openid profile email offline_access", prompt: "select_account" },
      },
    }),
  ],
  // Needed behind Plesk's Passenger reverse proxy in production (same as
  // cdcf-website); AUTH_URL pins the public origin.
  trustHost: true,
  // JWT strategy, not a database session: the tokens live in the encrypted
  // httpOnly cookie Auth.js already manages. Nothing here is readable by
  // browser JavaScript, which is the entire point of the BFF arrangement.
  session: { strategy: "jwt" },
  callbacks,
});
