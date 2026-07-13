import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Route guard (Next 16 renamed the `middleware` convention to `proxy`).
 * Only the session cookie/JWT is inspected here — no DB, no bcrypt — via the
 * edge-safe `authConfig`, whose `authorized` callback redirects logged-out
 * users to `/login`. This is the app's primary access gate.
 */
export const { auth: proxy } = NextAuth(authConfig);

export default proxy;

export const config = {
  // Guard every app page. `/api/*` is excluded because those routes enforce
  // their own auth (session check, or the `/api/sync` cron's CRON_SECRET bearer
  // token, which carries no session cookie). `login` + static assets + any file
  // with an extension (e.g. the vendored /geo TopoJSON) are excluded too.
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
