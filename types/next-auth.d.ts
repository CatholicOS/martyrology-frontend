import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    // Deliberately no accessToken — the session is browser-readable.
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    error?: string;
  }
}
