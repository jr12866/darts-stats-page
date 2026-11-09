"use client";

import { useActionState } from "react";
import { Card, CardHeader } from "@/components/ui";
import { createNight, type EntryState } from "@/app/l/[slug]/enter/actions";

export function NewNightForm({
  leagueSlug,
  groups,
  seasons,
}: {
  leagueSlug: string;
  groups: { id: string; name: string }[];
  seasons: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<EntryState | undefined, FormData>(
    (prev, formData) => createNight(leagueSlug, prev, formData),
    undefined,
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader
        title="Start a new night"
        description="Creates one match per format in the group's template."
      />
      <form action={action} className="grid gap-3 px-5 py-4 sm:grid-cols-4">
        <select
          name="groupId"
          required
          className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input
          name="date"
          type="date"
          defaultValue={today}
          required
          className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
        />
        <select
          name="seasonId"
          className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
        >
          <option value="">No season</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-3 py-2 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create night"}
        </button>
        {state?.error ? (
          <p className="text-sm text-red-300 sm:col-span-4">{state.error}</p>
        ) : null}
      </form>
    </Card>
  );
}
