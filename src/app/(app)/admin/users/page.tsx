import { notFound } from "next/navigation";
import { AdminPanel, ADMIN_TABS, type AdminTab } from "@/components/admin/admin-panel";
import { type SearchParams } from "@/lib/filters";
import { getFilters } from "@/lib/filters-server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** Manage Users — the same control panel, opened on Team Access. */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (user.role !== "admin") notFound();

  const sp = await searchParams;
  const f = await getFilters();
  const tabParam = one(sp.tab);
  const tab: AdminTab = ADMIN_TABS.some((t) => t.id === tabParam)
    ? (tabParam as AdminTab)
    : "team";

  return <AdminPanel tab={tab} storeId={f.storeId} basePath="/admin/users" />;
}
