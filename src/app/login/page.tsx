"use client";

import { useActionState } from "react";
import { LogIn, Loader2, AlertCircle } from "lucide-react";
import { authenticate } from "@/lib/auth-actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-base font-extrabold text-white">
            EA
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-white">EcomAnalytics</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to your analytics workspace.</p>

          <form action={formAction} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-ink">Email</label>
              <input
                name="email"
                type="email"
                required
                defaultValue="admin@dtalemodern.com"
                className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand-400"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-ink">Password</label>
              <input
                name="password"
                type="password"
                required
                defaultValue="password"
                className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand-400"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Sign In
            </button>
          </form>

          <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-ink-soft">
            Demo login is pre-filled — just click <span className="font-semibold">Sign In</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
