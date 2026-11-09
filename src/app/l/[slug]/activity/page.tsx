import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAdminLeague } from "@/lib/permissions";
import { Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";

export default function ActivityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading activity…</p>}>
        <Activity params={params} />
      </Suspense>
    </main>
  );
}

async function Activity({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const league = await prisma.league.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!league) notFound();

  const allowed = await canAdminLeague(league.id, user);
  if (!allowed) notFound();

  const logs = await prisma.changeLog.findMany({
    where: { leagueId: league.id },
    orderBy: { createdAt: "desc" },
    take: 250,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <>
      <header className="mb-6">
        <Link
          href={`/l/${slug}/admin`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← {league.name} admin
        </Link>
        <h1 className="mt-1 brass-text text-2xl font-bold tracking-wide">Activity</h1>
        <p className="mt-1 text-sm text-muted">
          Corrections made to recorded results, stats and configuration.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Change log"
          description={
            logs.length > 250
              ? "Showing the 250 most recent changes."
              : "Most recent first."
          }
        />
        {logs.length === 0 ? (
          <EmptyState
            title="No corrections logged yet"
            description="Changes to recorded results will appear here."
          />
        ) : (
          <Table
            head={
              <>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What</Th>
                <Th>From</Th>
                <Th>To</Th>
              </>
            }
          >
            {logs.map((log) => (
              <tr key={log.id}>
                <Td className="whitespace-nowrap text-muted">
                  {log.createdAt.toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Td>
                <Td className="font-medium">{log.user.name}</Td>
                <Td className="text-muted">
                  {describe(log.entity, log.field)}
                </Td>
                <Td className="text-muted">{log.oldValue ?? "—"}</Td>
                <Td className="font-medium">{log.newValue ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

/** Turns an entity/field pair into something readable. */
function describe(entity: string, field: string): string {
  const labels: Record<string, string> = {
    Leg: "Leg result",
    StatEvent: "High score",
    PointsEntry: "Points",
    MatchParticipant: "Line-up",
    StatDef: "Stat",
    Season: "Season",
    Group: "Group",
    Team: "Team",
  };

  const base = labels[entity] ?? entity;

  if (field === "deleted") return `${base} removed`;
  if (field === "lineup") return `${base} changed`;
  if (field === "winningSide") {
    return `${base} changed`;
  }
  if (field === "points") return `${base} changed`;
  if (field === "value") return `${base} value changed`;
  if (field === "retired") return `${base} retired/active`;
  if (field === "archived") return `${base} archived/active`;
  return `${base} · ${field}`;
}
