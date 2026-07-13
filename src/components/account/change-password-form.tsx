"use client";

import { useActionState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { changeOwnPassword } from "@/lib/account-actions";
import type { ActionState } from "@/lib/admin-actions";

const inputCls =
  "w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors duration-150 focus:border-brand-400";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    changeOwnPassword,
    undefined,
  );

  return (
    <form action={action} className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="currentPassword" className="text-sm font-semibold text-ink">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="newPassword" className="text-sm font-semibold text-ink">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="text-sm font-semibold text-ink">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputCls}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-xs font-medium text-neg">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-xs font-medium text-pos">
          {state.ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Update password
      </button>
    </form>
  );
}
