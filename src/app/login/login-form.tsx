"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState | undefined, FormData>(
    login,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p className="rounded border border-red/40 bg-red/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-accent px-3 py-2.5 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Pouring…" : "Sign in"}
      </button>
    </form>
  );
}
