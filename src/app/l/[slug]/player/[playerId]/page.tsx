import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { requireLeagueAccess } from "@/lib/permissions";
import { getPlayerCard } from "@/lib/stats";
import { Card, CardHeader, Table, Td, Th } from "@/components/ui";

export default function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; playerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading player…</p>}>
        <PlayerContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function PlayerContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; playerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug, playerId } = await params;
  const query = await searchParams;

  const user = await getSessionUser();
  const access = await requireLeagueAccess(slug, user, "view");
  if (!access) notFound();

  const { league } = access;

  const seasonId = firstValue(query.season) ?? "";
  const groupId = firstValue(query.group) ?? "";

  const card = await getPlayerCard(league.id, playerId, {
    seasonId: seasonId || null,
    groupId: groupId || null,
  });
  if (!card) notFound();

  const nights = await prisma.night.findMany({
    where: {
      leagueId: league.id,
      ...(seasonId ? { seasonId } : {}),
      ...(groupId ? { groupId } : {}),
    },
    orderBy: { date: "desc" },
    include: {
      group: { select: { name: true } },
      matches: {
        include: {
          legs: { select: { winningSide: true } },
          participants: { select: { playerId: true, side: true } },
          points: { select: { playerId: true, points: true } },
        },
      },
    },
  });

  const history = nights
    .map((night) => {
      let legsWon = 0;
      let legsLost = 0;
      let points = 0;
      for (const match of night.matches) {
        const side = match.participants.find(
          (p) => p.playerId === playerId,
        )?.side;
        if (!side) continue;
        for (const leg of match.legs) {
          if (leg.winningSide === null) continue;
          if (leg.winningSide === side) legsWon += 1;
          else legsLost += 1;
        }
        points +=
          match.points.find((p) => p.playerId === playerId)?.points ?? 0;
      }
      return {
        id: night.id,
        date: night.date,
        groupName: night.group.name,
        legsWon,
        legsLost,
        points,
      };
    })
    .filter((n) => n.legsWon + n.legsLost > 0 || n.points > 0);

  return (
    <>
      <header className="mb-6">
        <Link
          href={`/l/${slug}`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← {league.name}
        </Link>
        <h1 className="mt-1 brass-text text-2xl font-bold tracking-wide">
          {card.playerName}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {card.points} points · {card.matchesPlayed} matches · {card.legsWon}-
          {card.legsLost} legs
        </p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Tracked stats"
            description="Totals for the selected season and group."
          />
          {card.stats.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">
              No stats recorded for this player yet.
            </p>
          ) : (
            <Table
              head={
                <>
                  <Th>Stat</Th>
                  <Th>Type</Th>
                  <Th numeric>Total</Th>
                </>
              }
            >
              {card.stats.map((s) => (
                <tr key={s.statDefId}>
                  <Td className="font-medium">{s.name}</Td>
                  <Td className="text-muted">
                    {s.entryType === "VALUE" ? "Best" : "Count"}
                  </Td>
                  <Td numeric className="font-medium">
                    {s.total}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Night by night" />
          {history.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No results yet.</p>
          ) : (
            <Table
              head={
                <>
                  <Th>Date</Th>
                  <Th>Group</Th>
                  <Th numeric>Legs</Th>
                  <Th numeric>Points</Th>
                </>
              }
            >
              {history.map((n) => (
                <tr key={n.id}>
                  <Td className="font-medium">
                    {n.date.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </Td>
                  <Td className="text-muted">{n.groupName}</Td>
                  <Td numeric>
                    {n.legsWon}-{n.legsLost}
                  </Td>
                  <Td numeric className="font-medium">
                    {n.points}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
