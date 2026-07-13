"use client";

import { useActionState, useState } from "react";
import { RotateCcw, Loader2, Check, X } from "lucide-react";
import { resetTeamMemberPassword, type ActionState } from "@/lib/admin-actions";

/**
 * The ↻ action on a Team Access row: click to reveal an inline "new password"
 * field, submit to reset that member's password. Collapses on success.
 */
export function ResetPasswordControl({ userId, userName }: { userId: number; userName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    resetTeamMemberPassword,
    undefined,
  );

  // Collapse the editor when a reset succeeds. Adjusting state during render on
  // a changed value is React's recommended alternative to a setState-in-effect.
  const [handledOk, setHandledOk] = useState<string | undefined>(undefined);
  if (open && state?.ok && state.ok !== handledOk) {
    setHandledOk(state.ok);
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Reset password for ${userName}`}
          title="Reset password"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors duration-150 hover:bg-slate-50 hover:text-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        {state?.ok ? (
          <span role="status" className="text-[11px] font-medium text-pos">
            {state.ok}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <input type="hidden" name="id" value={userId} />
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoFocus
          placeholder="New password"
          aria-label={`New password for ${userName}`}
          className="w-40 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Confirm reset"
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 p-1.5 text-white transition-colors duration-150 hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="inline-flex items-center justify-center rounded-lg border border-line p-1.5 text-ink-soft transition-colors duration-150 hover:bg-slate-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {state?.error ? (
        <span role="alert" className="text-[11px] font-medium text-neg">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
