import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canEnter } from "@/lib/permissions";
import { Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";
import { NewNightForm } from "@/components/new-night-form";

export default function EnterIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <EnterIndex params={params} />
      </Suspense>
    </main>
  );
}

async function EnterIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const league = await prisma.league.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!league) notFound();

  const allowed = await canEnter(league.id, user);
  if (!allowed) notFound();

  const [nights, groups, seasons] = await Promise.all([
    prisma.night.findMany({
      where: { leagueId: league.id },
      orderBy: { date: "desc" },
      include: {
        group: { select: { name: true } },
        matches: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
    prisma.group.findMany({
      where: { leagueId: league.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.season.findMany({
      where: { leagueId: league.id, archived: false },
      orderBy: { name: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <header className="mb-6">
        <Link href={`/l/${slug}`} className="text-sm text-muted hover:text-foreground">
          ← {league.name}
        </Link>
        <h1 className="mt-1 brass-text text-2xl font-bold tracking-wide">Enter results</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a night, then open each match to record legs, high scores and
          points.{" "}
          <Link
            href={`/l/${slug}/activity`}
            className="font-medium text-accent hover:underline"
          >
            View activity log
          </Link>
        </p>
      </header>

      {groups.length > 0 ? (
        <div className="mb-6">
          <NewNightForm
            leagueSlug={slug}
            groups={groups}
            seasons={seasons}
          />
        </div>
      ) : null}

      {nights.length === 0 ? (
        <Card>
          <EmptyState
            title="No nights yet"
            description="Create a night to start entering results."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {nights.map((night) => (
            <Card key={night.id}>
              <CardHeader
                title={night.date.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                description={night.group.name}
              />
              {night.matches.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">
                  This night has no matches. Its group may have no template.
                </p>
              ) : (
                <Table
                  head={
                    <>
                      <Th>Match</Th>
                      <Th>Players</Th>
                      <Th />
                    </>
                  }
                >
                  {night.matches.map((m) => (
                    <tr key={m.id}>
                      <Td className="font-medium">{m.name ?? "Match"}</Td>
                      <Td className="text-muted">—</Td>
                      <Td>
                        <Link
                          href={`/l/${slug}/enter/${m.id}`}
                          className="text-sm font-medium text-accent hover:underline"
                        >
                          Enter →
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
