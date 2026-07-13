"use client";

import { useActionState, useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { addTeamMember, type ActionState } from "@/lib/admin-actions";
import { STORES } from "@/lib/constants";

const inputCls =
  "w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors duration-150 focus:border-brand-400";

export function AddMemberForm() {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    addTeamMember,
    undefined,
  );
  const [role, setRole] = useState<"sales" | "admin">("sales");
  const isAdmin = role === "admin";

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
          <select
            name="role"
            aria-label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as "sales" | "admin")}
            className={inputCls}
          >
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

      {/* Store access — scopes a sales member to specific stores. Admins always
          see every store, so the choice is disabled (and ignored) for them. */}
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="mb-1 w-full text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          Store access {isAdmin ? "(admins see all stores)" : ""}
        </legend>
        {STORES.map((s) => (
          <label
            key={s.id}
            className="inline-flex items-center gap-2 text-sm text-ink data-[disabled=true]:opacity-50"
            data-disabled={isAdmin}
          >
            <input
              type="checkbox"
              name="stores"
              value={s.id}
              defaultChecked
              disabled={isAdmin}
              className="h-4 w-4 rounded border-slate-300 accent-brand-500"
            />
            {s.name}
          </label>
        ))}
      </fieldset>

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
