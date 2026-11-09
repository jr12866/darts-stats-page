import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canEnter, canCorrect } from "@/lib/permissions";
import { MatchEntry } from "@/components/match-entry";
import { ParticipantPicker } from "@/components/participant-picker";

export default function MatchEntryPage({
  params,
}: {
  params: Promise<{ slug: string; matchId: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading match…</p>}>
        <MatchEntryContent params={params} />
      </Suspense>
    </main>
  );
}

async function MatchEntryContent({
  params,
}: {
  params: Promise<{ slug: string; matchId: string }>;
}) {
  const { slug, matchId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const match = await prisma.match.findFirst({
    where: { id: matchId, night: { league: { slug: slug } } },
    include: {
      night: {
        include: {
          league: { select: { id: true, name: true, slug: true } },
          group: { select: { name: true } },
          matches: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              mode: true,
              playersPerSide: true,
              legCount: true,
            },
          },
        },
      },
      participants: {
        orderBy: [{ side: "asc" }, { position: "asc" }],
        include: { player: { select: { id: true, name: true } } },
      },
      legs: {
        orderBy: { index: "asc" },
        include: {
          statEvents: {
            include: {
              player: { select: { id: true, name: true } },
              statDef: { select: { id: true, name: true, entryType: true } },
            },
          },
        },
      },
      points: { include: { player: { select: { id: true, name: true } } } },
    },
  });

  if (!match) notFound();

  const leagueId = match.night.league.id;
  const canEnterMatch = await canEnter(leagueId, user);
  if (!canEnterMatch) notFound();
  const canCorrectMatch = await canCorrect(leagueId, user);

  const statDefs = await prisma.statDef.findMany({
    where: { leagueId, retired: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, mode: true, entryType: true },
  });

  const leaguePlayers = await prisma.player.findMany({
    where: { leagueId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const sideA = match.participants.filter((p) => p.side === 1);
  const sideB = match.participants.filter((p) => p.side === 2);

  return (
    <>
      <header className="mb-6">
        <Link
          href={`/l/${slug}`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← {match.night.league.name}
        </Link>
        <h1 className="mt-1 brass-text text-2xl font-bold tracking-wide">
          {match.name ?? "Match"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {match.night.group.name} ·{" "}
          {match.night.date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      <ParticipantPicker
        leagueSlug={slug}
        matchId={match.id}
        leaguePlayers={leaguePlayers}
        sideA={sideA.map((p) => ({ id: p.player.id, name: p.player.name }))}
        sideB={sideB.map((p) => ({ id: p.player.id, name: p.player.name }))}
        playersPerSide={match.playersPerSide}
        rotation={match.rotation}
      />

      <MatchEntry
        leagueSlug={slug}
        matchId={match.id}
        mode={match.mode}
        checkoutRule={match.checkoutRule}
        playersPerSide={match.playersPerSide}
        rotation={match.rotation}
        sideA={sideA.map((p) => ({ id: p.player.id, name: p.player.name }))}
        sideB={sideB.map((p) => ({ id: p.player.id, name: p.player.name }))}
        legs={match.legs.map((leg) => ({
          id: leg.id,
          index: leg.index,
          winningSide: leg.winningSide,
          statEvents: leg.statEvents.map((e) => ({
            id: e.id,
            playerId: e.player.id,
            playerName: e.player.name,
            statDefId: e.statDef.id,
            statName: e.statDef.name,
            entryType: e.statDef.entryType,
            value: e.value,
          })),
        }))}
        points={match.points.map((p) => ({
          playerId: p.player.id,
          playerName: p.player.name,
          points: p.points,
        }))}
        statDefs={statDefs}
        canCorrect={canCorrectMatch}
        siblingMatches={match.night.matches.map((m) => ({
          id: m.id,
          name: m.name ?? "Match",
          mode: m.mode,
          playersPerSide: m.playersPerSide,
          legCount: m.legCount,
        }))}
      />
    </>
  );
}
