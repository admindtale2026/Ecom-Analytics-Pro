import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no DB / bcrypt imports) so it can be used by
 * middleware. The Credentials provider + DB lookup live in auth.ts (node).
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLogin = nextUrl.pathname.startsWith("/login");
      if (isLogin) return true; // let the login page render
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        // custom fields carried from authorize()
        const u = user as unknown as { id: string; role: string; storeAccess: string };
        token.uid = u.id;
        token.role = u.role;
        token.storeAccess = u.storeAccess;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const su = session.user as unknown as {
          id: number;
          role: string;
          storeAccess: string[];
        };
        su.id = Number(token.uid ?? 0);
        su.role = (token.role as string) ?? "sales";
        su.storeAccess = String(token.storeAccess ?? "modern,homes,decor").split(",");
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
