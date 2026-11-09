"use client";

import { useActionState, useState } from "react";
import {
  updateStatEvent,
  type EntryState,
} from "@/app/l/[slug]/enter/[matchId]/actions";

/**
 * Lets a league admin correct the value on a recorded stat without deleting
 * and re-adding it. The value is edited in place and saved with the enter
 * key or the save button. The editor closes once the save completes.
 */
export function StatValueEditor({
  leagueSlug,
  matchId,
  statEventId,
  value,
}: {
  leagueSlug: string;
  matchId: string;
  statEventId: string;
  value: number;
}) {
  const [state, action, pending] = useActionState<EntryState | undefined, FormData>(
    (prev, formData) => updateStatEvent(leagueSlug, matchId, prev, formData),
    undefined,
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  // Track the last saved value so a re-render with a new value resets the
  // draft without an effect.
  const [lastValue, setLastValue] = useState(value);
  // True once a save has finished, so the editor can close itself.
  const [saved, setSaved] = useState(false);

  if (value !== lastValue) {
    setLastValue(value);
    if (!editing) setDraft(String(value));
  }

  // Close the editor after the save round-trips.
  if (pending === false && saved) {
    setSaved(false);
    setEditing(false);
    setDraft(String(value));
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          aria-label="Edit value"
          className="rounded px-1.5 text-xs text-muted transition hover:bg-surface-raised hover:text-accent"
        >
          Edit value
        </button>
      </span>
    );
  }

  return (
    <form
      action={action}
      className="inline-flex items-center gap-1"
      onSubmit={() => setSaved(true)}
    >
      <input type="hidden" name="statEventId" value={statEventId} />
      <input
        name="value"
        type="number"
        min={0}
        value={draft}
        autoFocus
        aria-label="New value"
        data-testid="stat-value-input"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="w-16 rounded border border-border bg-surface px-1.5 py-0.5 text-right text-sm tabular-nums outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-border-strong bg-surface px-1.5 py-0.5 text-xs text-foreground transition hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {pending ? "…" : "Save value"}
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setEditing(false);
        }}
        className="rounded px-1.5 text-xs text-muted transition hover:bg-surface-raised hover:text-foreground"
      >
        Cancel
      </button>
      {state?.error ? (
        <span className="text-xs text-red-300">{state.error}</span>
      ) : null}
    </form>
  );
}
