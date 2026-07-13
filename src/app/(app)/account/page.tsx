import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { KeyRound } from "lucide-react";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { getCurrentUser } from "@/lib/session";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Account settings — any signed-in user can change their own password here. */
export default async function AccountPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6 anim-rise">
      <Card>
        <CardBody className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-base font-bold text-brand-600">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-ink">{user.name}</p>
            <p className="truncate text-sm text-ink-soft">{user.email || "—"}</p>
          </div>
          <span className="ml-auto rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            {user.role}
          </span>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle
            title="Change password"
            subtitle="Update the password you use to sign in."
            icon={<KeyRound className="h-5 w-5" />}
          />
          <ChangePasswordForm />
        </CardBody>
      </Card>
    </div>
  );
}
