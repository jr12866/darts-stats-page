import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { Card } from "@/components/ui";
import { ghostButtonClass } from "@/components/form";
import { logout } from "@/app/login/actions";

export default function LeaguesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Lighting the lamps…</p>}>
        <LeaguesList />
      </Suspense>
    </main>
  );
}

async function LeaguesList() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const memberships = await prisma.leagueMember.findMany({
    where: { userId: user.id },
    include: {
      league: {
        include: {
          _count: { select: { groups: true, nights: true, players: true } },
        },
      },
    },
    orderBy: { league: { name: "asc" } },
  });

  return (
    <>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="brass-text text-2xl font-bold tracking-wide">
            Your leagues
          </h1>
          <p className="mt-1 text-sm text-muted">
            Signed in as {user.name}
            {user.isPlatformAdmin ? " (site admin)" : ""}
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className={ghostButtonClass}>
            Sign out
          </button>
        </form>
      </header>

      {memberships.length === 0 ? (
        <Card>
          <div className="px-5 py-12 text-center">
            <p className="clover text-2xl leading-none" aria-hidden="true">
              ☘
            </p>
            <p className="mt-3 text-sm font-medium text-foreground">
              You are not on any leagues yet.
            </p>
            <p className="mt-1 text-sm text-muted">
              Ask the site admin to add you as a league admin or scorer.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {memberships.map(({ league, isLeagueAdmin, isScorer }) => (
            <div
              key={league.id}
              className="pub-card wood-grain rounded-lg border border-border-strong bg-surface p-5 shadow-lg shadow-black/30"
            >
              <Link href={`/l/${league.slug}`} className="block">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold tracking-wide text-foreground">
                      {league.name}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {league._count.groups} group
                      {league._count.groups === 1 ? "" : "s"} ·{" "}
                      {league._count.nights} night
                      {league._count.nights === 1 ? "" : "s"} ·{" "}
                      {league._count.players} player
                      {league._count.players === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {isLeagueAdmin ? (
                      <span className="rounded-full border border-accent/30 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                        League admin
                      </span>
                    ) : null}
                    {isScorer ? (
                      <span className="rounded-full border border-border-strong bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-muted">
                        Scorer
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
                <Link
                  href={`/l/${league.slug}`}
                  className="font-medium text-accent hover:underline"
                >
                  Dashboard
                </Link>
                <Link
                  href={`/public/${league.slug}`}
                  className="text-muted transition hover:text-foreground hover:underline"
                >
                  Public page
                </Link>
                {isLeagueAdmin ? (
                  <>
                    <Link
                      href={`/l/${league.slug}/enter`}
                      className="text-muted transition hover:text-foreground hover:underline"
                    >
                      Enter results
                    </Link>
                    <Link
                      href={`/l/${league.slug}/admin`}
                      className="text-muted transition hover:text-foreground hover:underline"
                    >
                      Admin
                    </Link>
                    <Link
                      href={`/l/${league.slug}/activity`}
                      className="text-muted transition hover:text-foreground hover:underline"
                    >
                      Activity
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
