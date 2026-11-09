"use client";

import { useActionState, useState } from "react";
import { Card, CardHeader } from "@/components/ui";
import { setParticipants, type EntryState } from "@/app/l/[slug]/enter/actions";

type Player = { id: string; name: string };

/**
 * Lets the scorer pick who played on each side of the match.
 *
 * Any league player can be selected, which is how substitutes are handled:
 * the roster is a convenience, not a restriction. A player already chosen on
 * one side is disabled on the other so they cannot end up on both.
 */
export function ParticipantPicker({
  leagueSlug,
  matchId,
  leaguePlayers,
  sideA,
  sideB,
  playersPerSide,
  rotation,
}: {
  leagueSlug: string;
  matchId: string;
  leaguePlayers: Player[];
  sideA: Player[];
  sideB: Player[];
  playersPerSide: number;
  rotation: boolean;
}) {
  const [state, action, pending] = useActionState<EntryState | undefined, FormData>(
    (prev, formData) => setParticipants(leagueSlug, matchId, prev, formData),
    undefined,
  );

  const [open, setOpen] = useState(sideA.length === 0 && sideB.length === 0);

  // Track which side each player is on so we can disable the other side.
  const [sideAIds, setSideAIds] = useState<string[]>(sideA.map((p) => p.id));
  const [sideBIds, setSideBIds] = useState<string[]>(sideB.map((p) => p.id));

  const label = rotation
    ? `Players per side (rotation, ${playersPerSide})`
    : `Players per side`;

  return (
    <Card>
      <CardHeader
        title="Who played?"
        description={
          sideA.length === 0 && sideB.length === 0
            ? "Select the players for each side."
            : `${sideA.length} vs ${sideB.length} selected.`
        }
        action={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded border border-border-strong bg-surface px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-accent"
          >
            {open ? "Close" : "Edit players"}
          </button>
        }
      />

      {open ? (
        <form action={action} className="space-y-4 px-5 py-4">
          <p className="text-sm text-muted">{label}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((side) => (
              <fieldset key={side}>
                <legend className="mb-2 text-sm font-medium">
                  {side === 1 ? "Side A" : "Side B"}
                </legend>
                <div className="space-y-1">
                  {leaguePlayers.map((p) => {
                    const onA = sideAIds.includes(p.id);
                    const onB = sideBIds.includes(p.id);
                    const checked = side === 1 ? onA : onB;
                    // A player picked on one side cannot be picked on the other.
                    const disabled = side === 1 ? onB : onA;

                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 text-sm ${
                          disabled ? "text-muted" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          name={side === 1 ? "sideA" : "sideB"}
                          value={p.id}
                          defaultChecked={checked}
                          disabled={disabled}
                          onChange={(e) => {
                            const setter =
                              side === 1 ? setSideAIds : setSideBIds;
                            const other =
                              side === 1 ? setSideBIds : setSideAIds;
                            const list = side === 1 ? sideAIds : sideBIds;
                            if (e.target.checked) {
                              setter([...list, p.id]);
                            } else {
                              setter(list.filter((id) => id !== p.id));
                            }
                            // Clear the other side if this player was on it.
                            const otherList = side === 1 ? sideBIds : sideAIds;
                            if (e.target.checked && otherList.includes(p.id)) {
                              other(otherList.filter((id) => id !== p.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-border"
                        />
                        {p.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="rounded bg-accent px-3 py-2 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save players"}
          </button>

          {state?.error ? (
            <p className="text-sm text-red-300">{state.error}</p>
          ) : null}
          {state?.ok ? <p className="text-sm text-green">{state.ok}</p> : null}
        </form>
      ) : null}
    </Card>
  );
}
