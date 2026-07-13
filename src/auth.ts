import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { db } from "./db/client";
import { users } from "./db/schema";

// AUTH_SECRET is mandatory in production: a missing/weak one lets anyone forge a
// session JWT. We do NOT hand-roll a check here — NextAuth v5 already refuses to
// operate in production without a secret (throwing at request time), and a
// module-level throw breaks `next build`'s page-data collection. So enforcement
// lives with NextAuth at runtime; set a strong AUTH_SECRET (openssl rand -base64
// 32) in the deploy environment.
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
