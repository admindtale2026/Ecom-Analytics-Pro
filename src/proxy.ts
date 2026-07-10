import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-safe: only the cookie/JWT is inspected here (no DB).
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  // Protect app pages. All /api routes are excluded (they enforce their own
  // auth: session check or CRON_SECRET), as are login + static assets.
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
