import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";
import { AdminControls } from "@/components/admin-controls";

export default function PlatformAdminPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <PlatformAdmin />
      </Suspense>
    </main>
  );
}

async function PlatformAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isPlatformAdmin) redirect("/leagues");

  const [leagues, users] = await Promise.all([
    prisma.league.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { groups: true, nights: true, members: true } },
        members: { include: { user: { select: { name: true, email: true } } } },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        isPlatformAdmin: true,
        _count: { select: { memberships: true } },
      },
    }),
  ]);

  return (
    <>
      <header className="mb-6">
        <h1 className="brass-text text-2xl font-bold tracking-wide">Site admin</h1>
        <p className="mt-1 text-sm text-muted">
          Seed leagues, create accounts and remove leagues on request.
        </p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Leagues"
            description="Each league is isolated: its own groups, teams, stats, seasons and members."
          />
          <div className="space-y-4 px-5 py-4">
            {leagues.length === 0 ? (
              <EmptyState title="No leagues yet" />
            ) : (
              <Table
                head={
                  <>
                    <Th>League</Th>
                    <Th>Groups</Th>
                    <Th>Nights</Th>
                    <Th>Admins</Th>
                    <Th />
                  </>
                }
              >
                {leagues.map((l) => (
                  <tr key={l.id}>
                    <Td className="font-medium">
                      <Link
                        href={`/l/${l.slug}`}
                        className="text-accent hover:underline"
                      >
                        {l.name}
                      </Link>
                      <span className="ml-2 text-xs text-muted">/{l.slug}</span>
                    </Td>
                    <Td className="text-muted">{l._count.groups}</Td>
                    <Td className="text-muted">{l._count.nights}</Td>
                    <Td className="text-muted">
                      {l.members
                        .filter((m) => m.isLeagueAdmin)
                        .map((m) => m.user.name)
                        .join(", ") || "—"}
                    </Td>
                    <Td>
                      <AdminControls leagueId={l.id} leagueName={l.name} />
                    </Td>
                  </tr>
                ))}
              </Table>
            )}

            <AdminControls showCreateLeague />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Accounts"
            description="Only admins and scorers need accounts. Players are name-only records inside a league."
          />
          <div className="space-y-4 px-5 py-4">
            <Table
              head={
                <>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Leagues</Th>
                  <Th>Site admin</Th>
                </>
              }
            >
              {users.map((u) => (
                <tr key={u.id}>
                  <Td className="font-medium">{u.name}</Td>
                  <Td className="text-muted">{u.email}</Td>
                  <Td className="text-muted">{u._count.memberships}</Td>
                  <Td className="text-muted">
                    {u.isPlatformAdmin ? "Yes" : "—"}
                  </Td>
                </tr>
              ))}
            </Table>

            <AdminControls showCreateUser />
          </div>
        </Card>
      </div>
    </>
  );
}
