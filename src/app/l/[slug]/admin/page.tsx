import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAdminLeague } from "@/lib/permissions";
import { AdminPanel } from "@/components/admin-panel";

export default function AdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <AdminContent params={params} />
      </Suspense>
    </main>
  );
}

async function AdminContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const league = await prisma.league.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, teamRankingMode: true },
  });
  if (!league) notFound();

  const allowed = await canAdminLeague(league.id, user);
  if (!allowed) notFound();

  const [groups, statDefs, seasons, members, templates] = await Promise.all([
    prisma.group.findMany({
      where: { leagueId: league.id },
      orderBy: { sortOrder: "asc" },
      include: {
        teams: {
          orderBy: { sortOrder: "asc" },
          include: { roster: { include: { player: true } } },
        },
      },
    }),
    prisma.statDef.findMany({
      where: { leagueId: league.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.season.findMany({
      where: { leagueId: league.id },
      orderBy: { name: "desc" },
    }),
    prisma.leagueMember.findMany({
      where: { leagueId: league.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.template.findMany({
      where: { group: { leagueId: league.id } },
      include: {
        group: { select: { id: true, name: true } },
        matchSpecs: { orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);

  return (
    <>
      <header className="mb-6">
        <h1 className="brass-text text-2xl font-bold tracking-wide">
          {league.name} · Admin
        </h1>
        <p className="mt-1 text-sm text-muted">
          Configure groups, teams, stat definitions, seasons and match formats.{" "}
          <Link
            href={`/l/${slug}/activity`}
            className="font-medium text-accent hover:underline"
          >
            View activity log
          </Link>
        </p>
        <p className="mt-1 text-sm text-muted">
          Public link:{" "}
          <a
            href={`/public/${slug}`}
            className="font-medium text-accent hover:underline"
          >
            /public/{slug}
          </a>{" "}
          — anyone with the link can view standings, high scores and results.
        </p>
      </header>

      <AdminPanel
        leagueSlug={league.slug}
        leagueName={league.name}
        teamRankingMode={league.teamRankingMode}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          teams: g.teams.map((t) => ({
            id: t.id,
            name: t.name,
            roster: t.roster.map((r) => ({
              id: r.id,
              name: r.player.name,
            })),
          })),
        }))}
        statDefs={statDefs.map((s) => ({
          id: s.id,
          name: s.name,
          mode: s.mode,
          entryType: s.entryType,
          retired: s.retired,
        }))}
        seasons={seasons.map((s) => ({
          id: s.id,
          name: s.name,
          archived: s.archived,
          startDate: s.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: s.endDate?.toISOString().slice(0, 10) ?? null,
        }))}
        members={members.map((m) => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          isLeagueAdmin: m.isLeagueAdmin,
          isScorer: m.isScorer,
        }))}
        templates={templates.map((t) => ({
          id: t.id,
          groupId: t.group.id,
          groupName: t.group.name,
          name: t.name,
          matchSpecs: t.matchSpecs.map((s) => ({
            id: s.id,
            name: s.name,
            mode: s.mode,
            playersPerSide: s.playersPerSide,
            rotation: s.rotation,
            legCount: s.legCount,
            checkoutRule: s.checkoutRule,
            cricketTarget: s.cricketTarget,
            startScore: s.startScore,
          })),
        }))}
      />
    </>
  );
}
