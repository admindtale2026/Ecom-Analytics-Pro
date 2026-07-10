import { cache } from "react";

/**
 * Current-user accessor. Wired to Auth.js in the auth task; until then it
 * returns a demo admin so the shell renders during development.
 */
export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "sales";
  storeAccess: string[];
};

/**
 * The dev convenience above must never reach production: `/api/upload` and
 * `/api/sync` gate on `role === "admin"`, so a demo-admin fallback would leave
 * those mutation endpoints open to anyone who could reach them. In production
 * an unauthenticated caller is anonymous with no store access, and those
 * handlers reject it.
 */
const ANONYMOUS: SessionUser = {
  id: 0,
  name: "Guest",
  email: "",
  role: "sales",
  storeAccess: [],
};

const DEMO_ADMIN: SessionUser = {
  id: 0,
  name: "Joju",
  email: "admin@dtalemodern.com",
  role: "admin",
  storeAccess: ["modern", "homes", "decor"],
};

/** `cache()` dedupes the session lookup across layout, page and server actions. */
export const getCurrentUser = cache(async (): Promise<SessionUser> => {
  try {
    // Lazy import so this module has no hard dependency until auth is wired.
    const mod = await import("@/auth");
    const session = await mod.auth();
    if (session?.user) {
      return session.user as unknown as SessionUser;
    }
  } catch {
    // auth not configured yet — fall through
  }
  return process.env.NODE_ENV === "production" ? ANONYMOUS : DEMO_ADMIN;
});
