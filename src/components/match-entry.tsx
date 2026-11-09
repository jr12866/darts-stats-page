"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Table, Td, Th } from "@/components/ui";
import { StatValueEditor } from "@/components/stat-value-editor";
import {
  addStatEvent,
  clearLegResult,
  deleteStatEvent,
  setLegResult,
  setPoints,
  type EntryState,
} from "@/app/l/[slug]/enter/[matchId]/actions";

type Player = { id: string; name: string };
type Leg = {
  id: string;
  index: number;
  winningSide: number | null;
  statEvents: {
    id: string;
    playerId: string;
    playerName: string;
    statDefId: string;
    statName: string;
    entryType: string;
    value: number;
  }[];
};
type StatDef = {
  id: string;
  name: string;
  mode: string;
  entryType: string;
};

export function MatchEntry({
  leagueSlug,
  matchId,
  mode,
  checkoutRule,
  sideA,
  sideB,
  legs,
  points,
  statDefs,
  canCorrect,
  siblingMatches,
}: {
  leagueSlug: string;
  matchId: string;
  mode: string;
  checkoutRule: string;
  playersPerSide: number;
  rotation: boolean;
  sideA: Player[];
  sideB: Player[];
  legs: Leg[];
  points: { playerId: string; playerName: string; points: number }[];
  statDefs: StatDef[];
  canCorrect: boolean;
  siblingMatches: { id: string; name: string; mode: string; playersPerSide: number; legCount: number }[];
}) {
  const router = useRouter();
  const allPlayers = [...sideA, ...sideB];

  // Stats usable for this match mode.
  const usableStats = statDefs.filter(
    (s) => s.mode === "ANY" || s.mode === (mode === "CRICKET" ? "CRICKET" : "ZERO1"),
  );

  return (
    <div className="space-y-6">
      {siblingMatches.length > 1 ? (
        <Card>
          <CardHeader title="Matches this night" />
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {siblingMatches.map((m) => {
              const active = m.id === matchId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => router.push(`/l/${leagueSlug}/enter/${m.id}`)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    active
                      ? "border-accent bg-accent-soft font-medium text-accent"
                      : "border-border bg-surface hover:bg-surface-raised"
                  }`}
                >
                  {m.name}
                  <span className="ml-1.5 text-xs text-muted">
                    {m.mode === "CRICKET" ? "Cricket" : "01"} · {m.legCount}L
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      {legs.map((leg) => (
        <LegCard
          key={leg.id}
          leagueSlug={leagueSlug}
          matchId={matchId}
          leg={leg}
          sideA={sideA}
          sideB={sideB}
          usableStats={usableStats}
          checkoutRule={checkoutRule}
          canCorrect={canCorrect}
        />
      ))}

      <PointsCard
        leagueSlug={leagueSlug}
        matchId={matchId}
        players={allPlayers}
        points={points}
      />
    </div>
  );
}

function LegCard({
  leagueSlug,
  matchId,
  leg,
  sideA,
  sideB,
  usableStats,
  checkoutRule,
  canCorrect,
}: {
  leagueSlug: string;
  matchId: string;
  leg: Leg;
  sideA: Player[];
  sideB: Player[];
  usableStats: StatDef[];
  checkoutRule: string;
  canCorrect: boolean;
}) {
  const [clearState, clearAction] = useActionState<
    EntryState | undefined,
    FormData
  >((prev, formData) => clearLegResult(leagueSlug, matchId, prev, formData), undefined);

  const allPlayers = [...sideA, ...sideB];

  return (
    <Card>
      <CardHeader
        title={`Leg ${leg.index + 1}`}
        description={
          leg.winningSide
            ? `${leg.winningSide === 1 ? sideLabel(sideA) : sideLabel(sideB)} won`
            : "Not scored yet"
        }
        action={
          leg.winningSide && canCorrect ? (
            <form action={clearAction}>
              <input type="hidden" name="index" value={leg.index} />
              <button
                type="submit"
                className="rounded border border-border-strong bg-surface px-2 py-1 text-xs text-muted transition hover:border-red hover:text-red"
              >
                Clear
              </button>
            </form>
          ) : null
        }
      />

      <div className="space-y-4 px-5 py-4">
        <ResultForm
          leagueSlug={leagueSlug}
          matchId={matchId}
          legIndex={leg.index}
          sideA={sideA}
          sideB={sideB}
          winningSide={leg.winningSide}
        />

        {clearState?.error ? (
          <p className="text-sm text-red-300">{clearState.error}</p>
        ) : null}

        <StatEvents
          leagueSlug={leagueSlug}
          matchId={matchId}
          leg={leg}
          players={allPlayers}
          usableStats={usableStats}
          canCorrect={canCorrect}
          checkoutRule={checkoutRule}
        />
      </div>
    </Card>
  );
}

/**
 * A separate form handles the leg result so the "winning side" buttons can
 * submit the leg index and the side together.
 */
function ResultForm({
  leagueSlug,
  matchId,
  legIndex,
  sideA,
  sideB,
  winningSide,
}: {
  leagueSlug: string;
  matchId: string;
  legIndex: number;
  sideA: Player[];
  sideB: Player[];
  winningSide: number | null;
}) {
  const [state, action] = useActionState<EntryState | undefined, FormData>(
    (prev, formData) => setLegResult(leagueSlug, matchId, prev, formData),
    undefined,
  );

  return (
    <form action={action}>
      <input type="hidden" name="index" value={legIndex} />
      <div className="grid gap-3 sm:grid-cols-2">
        {[sideA, sideB].map((side, i) => (
          <button
            key={i}
            type="submit"
            name="winningSide"
            value={i + 1}
            className={`rounded-lg border px-4 py-3 text-left transition ${
              winningSide === i + 1
                ? "border-accent bg-accent-soft shadow-[0_0_0_1px_rgba(201,162,39,0.3),0_6px_20px_-8px_rgba(201,162,39,0.5)]"
                : "border-border-strong bg-surface hover:border-accent/50 hover:bg-surface-raised"
            }`}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
              {winningSide === i + 1 ? (
                <span className="text-accent" aria-hidden="true">
                  ●
                </span>
              ) : null}
              {sideLabel(side)}
            </span>
            <span className="mt-1 block text-sm font-medium text-foreground">
              {side.map((p) => p.name).join(", ") || "—"}
            </span>
          </button>
        ))}
      </div>
      {state?.error ? <p className="mt-2 text-sm text-red-300">{state.error}</p> : null}
    </form>
  );
}

function StatEvents({
  leagueSlug,
  matchId,
  leg,
  players,
  usableStats,
  canCorrect,
  checkoutRule,
}: {
  leagueSlug: string;
  matchId: string;
  leg: Leg;
  players: Player[];
  usableStats: StatDef[];
  canCorrect: boolean;
  checkoutRule: string;
}) {
  const [state, action, pending] = useActionState<EntryState | undefined, FormData>(
    (prev, formData) => addStatEvent(leagueSlug, matchId, prev, formData),
    undefined,
  );
  const [deleteState, deleteAction] = useActionState<
    EntryState | undefined,
    FormData
  >((prev, formData) => deleteStatEvent(leagueSlug, matchId, prev, formData), undefined);

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">High scores</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded border border-border-strong bg-surface px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-accent"
        >
          {showForm ? "Close" : `+ Add high score (leg ${leg.index + 1})`}
        </button>
      </div>

      {checkoutHint(checkoutRule) ? (
        <p className="mb-2 text-xs text-muted">{checkoutHint(checkoutRule)}</p>
      ) : null}

      {leg.statEvents.length > 0 ? (
        <Table
          head={
            <>
              <Th>Player</Th>
              <Th>Stat</Th>
              <Th numeric>Value</Th>
              {canCorrect ? <Th /> : null}
            </>
          }
        >
          {leg.statEvents.map((e) => (
            <tr key={e.id}>
              <Td className="font-medium">{e.playerName}</Td>
              <Td className="text-muted">{e.statName}</Td>
              <Td numeric>
                {canCorrect ? (
                  <StatValueEditor
                    leagueSlug={leagueSlug}
                    matchId={matchId}
                    statEventId={e.id}
                    value={e.value}
                  />
                ) : (
                  e.value
                )}
              </Td>
              {canCorrect ? (
                <Td>
                  <form action={deleteAction} className="flex justify-end">
                    <input type="hidden" name="statEventId" value={e.id} />
                    <button
                      type="submit"
                      aria-label="Remove entry"
                      className="rounded-full px-1.5 text-muted transition hover:bg-red/15 hover:text-red"
                    >
                      ×
                    </button>
                  </form>
                </Td>
              ) : null}
            </tr>
          ))}
        </Table>
      ) : (
        <p className="text-sm text-muted">No stats recorded for this leg.</p>
      )}

      {showForm ? (
        <form action={action} className="mt-3 grid gap-2 sm:grid-cols-4">
          <input type="hidden" name="legIndex" value={leg.index} />
          <p className="text-xs text-muted sm:col-span-4">
            Recording for leg {leg.index + 1}.
          </p>
          <select
            name="playerId"
            required
            aria-label="Player"
            className="rounded border border-border-strong bg-background px-2.5 py-1.5 text-sm text-foreground outline-none transition focus:border-accent"
          >
            <option value="">Player…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="statDefId"
            required
            aria-label="Stat"
            className="rounded border border-border-strong bg-background px-2.5 py-1.5 text-sm text-foreground outline-none transition focus:border-accent"
          >
            <option value="">Stat…</option>
            {usableStats.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.entryType === "VALUE" ? " (value)" : ""}
              </option>
            ))}
          </select>
          <input
            name="value"
            type="number"
            min={0}
            defaultValue={1}
            required
            aria-label="Value"
            className="rounded border border-border-strong bg-background px-2.5 py-1.5 text-sm text-foreground outline-none transition focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Record stat"}
          </button>
          {state?.error ? (
            <p className="text-sm text-red-300 sm:col-span-4">{state.error}</p>
          ) : null}
          {deleteState?.error ? (
            <p className="text-sm text-red-300 sm:col-span-4">{deleteState.error}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function PointsCard({
  leagueSlug,
  matchId,
  players,
  points,
}: {
  leagueSlug: string;
  matchId: string;
  players: Player[];
  points: { playerId: string; playerName: string; points: number }[];
}) {
  const [state, action, pending] = useActionState<EntryState | undefined, FormData>(
    (prev, formData) => setPoints(leagueSlug, matchId, prev, formData),
    undefined,
  );

  const pointsByPlayer = new Map(points.map((p) => [p.playerId, p.points]));

  return (
    <Card>
      <CardHeader
        title="Points"
        description="Entered by hand — the league decides how points are awarded."
      />
      <div className="px-5 py-4">
        {players.length === 0 ? (
          <p className="text-sm text-muted">No players in this match yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {players.map((p) => (
              <form
                key={p.id}
                action={action}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="playerId" value={p.id} />
                <label
                  htmlFor={`points-${p.id}`}
                  className="flex-1 truncate text-sm"
                >
                  {p.name}
                </label>
                <input
                  id={`points-${p.id}`}
                  name="points"
                  type="number"
                  defaultValue={pointsByPlayer.get(p.id) ?? 0}
                  className="w-20 rounded border border-border-strong bg-background px-2 py-1.5 text-sm text-foreground tabular-nums outline-none transition focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg border border-border-strong px-2.5 py-1.5 text-xs hover:bg-surface-raised disabled:opacity-60"
                >
                  Save
                </button>
              </form>
            ))}
          </div>
        )}
        {state?.error ? (
          <p className="mt-2 text-sm text-red-300">{state.error}</p>
        ) : null}
        {state?.ok ? <p className="mt-2 text-sm text-green">{state.ok}</p> : null}
      </div>
    </Card>
  );
}

function sideLabel(side: Player[]): string {
  if (side.length === 0) return "Side";
  if (side.length === 1) return "Side A";
  return `Side (${side.length})`;
}

/**
 * A short hint about which value-style stat applies to this leg, based on
 * the checkout rule the template specifies.
 */
function checkoutHint(checkoutRule: string): string | null {
  if (checkoutRule === "DOUBLE_OUT") {
    return "Double out leg: record the checkout value as High Out.";
  }
  if (checkoutRule === "DOUBLE_IN") {
    return "Double in leg: record the score you were on at your first double as High In.";
  }
  return null;
}
