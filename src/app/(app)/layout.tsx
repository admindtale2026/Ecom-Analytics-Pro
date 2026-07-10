import { AppShell } from "@/components/layout/app-shell";
import { getSalespeople } from "@/server/common";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, people] = await Promise.all([getCurrentUser(), getSalespeople()]);
  return (
    <AppShell role={user.role} userName={user.name} people={people}>
      {children}
    </AppShell>
  );
}
