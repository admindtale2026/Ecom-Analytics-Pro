"use client";

import { useActionState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { addTeamMember, type ActionState } from "@/lib/admin-actions";

const inputCls =
  "w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors duration-150 focus:border-brand-400";

export function AddMemberForm() {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    addTeamMember,
    undefined,
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input name="name" placeholder="Full name" aria-label="Full name" required className={inputCls} />
        <input name="email" type="email" placeholder="Email" aria-label="Email" required className={inputCls} />
        <input
          name="password"
          type="password"
          placeholder="Password (min 8 chars)"
          aria-label="Password"
          required
          minLength={8}
          className={inputCls}
        />
        <div className="flex gap-2">
          <select name="role" aria-label="Role" defaultValue="sales" className={inputCls}>
            <option value="sales">Sales</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-600 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add
          </button>
        </div>
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
    </form>
  );
}
