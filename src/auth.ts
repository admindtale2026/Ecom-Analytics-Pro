import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { db } from "./db/client";
import { users } from "./db/schema";

// Fail hard, not open: a missing/weak AUTH_SECRET lets anyone forge a session
// JWT and walk in as admin. Refuse to boot the auth stack in production without
// a strong one (32 random bytes base64 ≈ 44 chars; require ≥ 16 to be safe).
if (process.env.NODE_ENV === "production" && (process.env.AUTH_SECRET ?? "").length < 16) {
  throw new Error(
    "AUTH_SECRET is missing or too weak. Set a strong value (openssl rand -base64 32) before deploying.",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!u) return null;
        const ok = await bcrypt.compare(password, u.passwordHash);
        if (!ok) return null;
        return {
          id: String(u.id),
          name: u.name,
          email: u.email,
          role: u.role,
          storeAccess: u.storeAccess,
        } as unknown as { id: string };
      },
    }),
  ],
});
