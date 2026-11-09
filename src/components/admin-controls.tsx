"use client";

import { useActionState } from "react";
import {
  createLeague,
  createUser,
  deleteLeague,
  type ActionState,
} from "@/app/admin/actions";

export function AdminControls({
  leagueId,
  leagueName,
  showCreateLeague = false,
  showCreateUser = false,
}: {
  leagueId?: string;
  leagueName?: string;
  showCreateLeague?: boolean;
  showCreateUser?: boolean;
}) {
  if (leagueId) {
    return <DeleteLeague leagueId={leagueId} leagueName={leagueName ?? ""} />;
  }
  if (showCreateLeague) {
    return <CreateLeagueForm />;
  }
  if (showCreateUser) {
    return <CreateUserForm />;
  }
  return null;
}

function Feedback({ state }: { state: ActionState | undefined }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p
      className={`mt-2 text-sm ${state.error ? "text-red-300" : "text-green"}`}
    >
      {state.error ?? state.ok}
    </p>
  );
}

function CreateLeagueForm() {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    createLeague,
    undefined,
  );

  return (
    <form
      action={action}
      className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4"
    >
      <input
        name="name"
        placeholder="Tuesday Night Darts"
        required
        className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
      />
      <input
        name="adminEmail"
        type="email"
        placeholder="admin@example.com (optional)"
        className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent sm:col-span-2"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-3 py-2 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create league"}
      </button>
      <div className="sm:col-span-4">
        <Feedback state={state} />
      </div>
    </form>
  );
}

function CreateUserForm() {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    createUser,
    undefined,
  );

  return (
    <form
      action={action}
      className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4"
    >
      <input
        name="name"
        placeholder="Jordan Reyes"
        required
        className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
      />
      <input
        name="email"
        type="email"
        placeholder="jordan@example.com"
        required
        className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
      />
      <input
        name="password"
        type="password"
        placeholder="Initial password"
        required
        minLength={8}
        className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-3 py-2 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create account"}
      </button>
      <div className="sm:col-span-4">
        <Feedback state={state} />
      </div>
    </form>
  );
}

function DeleteLeague({
  leagueId,
  leagueName,
}: {
  leagueId: string;
  leagueName: string;
}) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    deleteLeague,
    undefined,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="leagueId" value={leagueId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-border-strong bg-surface px-2 py-1 text-xs text-muted transition hover:border-red hover:text-red disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
      </form>
      {state?.error ? (
        <p className="text-xs text-red-300">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-xs text-green">{state.ok}</p>
      ) : null}
      <span className="sr-only">{leagueName}</span>
    </div>
  );
}
