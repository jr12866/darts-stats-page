import { notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { requireLeagueAccess } from "@/lib/permissions";
import { LeagueTabs } from "@/components/league-tabs";

export default function LeagueDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading league…</p>}>
        <LeagueContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LeagueContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const user = await getSessionUser();
  const access = await requireLeagueAccess(slug, user, "view");
  if (!access) notFound();

  const { league, permission } = access;

  const [seasons, groups] = await Promise.all([
    prisma.season.findMany({
      where: { leagueId: league.id },
      orderBy: [{ archived: "asc" }, { name: "desc" }],
    }),
    prisma.group.findMany({
      where: { leagueId: league.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const tab = firstValue(query.tab) ?? "standings";
  const seasonId = firstValue(query.season) ?? "";
  const groupId = firstValue(query.group) ?? "";

  return (
    <>
      <header className="mb-6">
        <h1 className="brass-text text-2xl font-bold tracking-wide">
          {league.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Standings, high scores and match results.
        </p>
      </header>

      <LeagueTabs
        leagueSlug={league.slug}
        tab={tab}
        seasonId={seasonId}
        groupId={groupId}
        seasons={seasons.map((s) => ({
          id: s.id,
          name: s.name,
          archived: s.archived,
        }))}
        groups={groups}
        permission={permission}
        basePath={`/l/${league.slug}`}
      />
    </>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
