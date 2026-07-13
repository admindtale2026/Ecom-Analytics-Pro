import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSalespeople } from "@/server/common";
import { getCurrentUser, canAccessStore } from "@/lib/session";
import { getFilters } from "@/lib/filters-server";
import { STORES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, filters] = await Promise.all([getCurrentUser(), getFilters()]);
  const people = await getSalespeople(filters.storeId);
  // Defense in depth behind the proxy: an unauthenticated request has no email
  // (the anonymous guest), so no analytics ever renders without a session.
  if (!user.email) redirect("/login");
  // Only offer the stores this user may access — admins get all of them.
  const allowedStores = STORES.map((s) => s.id).filter((id) => canAccessStore(user, id));
  return (
    <AppShell
      role={user.role}
      userName={user.name}
      people={people}
      filters={filters}
      allowedStores={allowedStores}
    >
      {children}
    </AppShell>
  );
}
