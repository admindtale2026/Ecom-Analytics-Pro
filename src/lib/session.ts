import { cache } from "react";
import type { StoreId } from "@/lib/constants";

/** The signed-in user, as projected from the Auth.js session. */
export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "sales";
  storeAccess: string[];
};

/**
 * Fail-closed default for anyone without a valid session. Zero id, `sales`
 * role, and — critically — **no store access**, so every admin/mutation gate
 * (`role === "admin"`) and every per-store check rejects it.
 *
 * There is deliberately NO "demo admin" fallback: a convenience that returned
 * an admin outside production would open `/api/upload`, `/api/sync`, the export
 * route and the whole admin panel to any anonymous caller on any box where
 * `NODE_ENV` wasn't exactly "production". Auth now fails closed everywhere.
 */
const ANONYMOUS: SessionUser = {
  id: 0,
  name: "Guest",
  email: "",
  role: "sales",
  storeAccess: [],
};

/** `cache()` dedupes the session lookup across layout, page and server actions. */
export const getCurrentUser = cache(async (): Promise<SessionUser> => {
  try {
    // Lazy import keeps this module free of the Node-only auth stack until used.
    const mod = await import("@/auth");
    const session = await mod.auth();
    if (session?.user) {
      return session.user as unknown as SessionUser;
    }
  } catch {
    // Session backend unavailable — treat as unauthenticated, never elevate.
  }
  return ANONYMOUS;
});

/** True if the user may see data for `storeId`. Admins see every store. */
export function canAccessStore(user: SessionUser, storeId: StoreId): boolean {
  return user.role === "admin" || user.storeAccess.includes(storeId);
}

/**
 * Throw unless the user may access `storeId`. Use at every boundary that
 * resolves a caller-supplied store (page filters, exports) so a `sales` user
 * scoped to one store cannot read another by changing the `store` param.
 */
export function assertStoreAccess(user: SessionUser, storeId: StoreId): void {
  if (!canAccessStore(user, storeId)) {
    throw Object.assign(new Error("You do not have access to that store."), {
      status: 403,
    });
  }
}
