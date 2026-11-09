import Link from "next/link";
import { getStatBoards, getPlayerStandings, getTeamStandings } from "@/lib/stats";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, Rank, Table, Td, Th } from "@/components/ui";

type SeasonOption = { id: string; name: string; archived: boolean };
type GroupOption = { id: string; name: string };

const TABS = [
  { key: "standings", label: "Standings" },
  { key: "players", label: "Players" },
  { key: "highscores", label: "High Scores" },
  { key: "results", label: "Results" },
] as const;

export async function LeagueTabs({
  leagueSlug,
  tab,
  seasonId,
  groupId,
  seasons,
  groups,
  permission,
  basePath,
  showMemberLinks = true,
}: {
  leagueSlug: string;
  tab: string;
  seasonId: string;
  groupId: string;
  seasons: SeasonOption[];
  groups: GroupOption[];
  permission: string;
  /** Route prefix for tab and filter links. */
  basePath: string;
  /** Whether to show links into the member-only areas. */
  showMemberLinks?: boolean;
}) {
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true, name: true, teamRankingMode: true },
  });
  if (!league) return null;

  const filter = {
    leagueId: league.id,
    seasonId: seasonId || null,
    groupId: groupId || null,
  };

  const buildHref = (nextTab: string) => {
    const params = new URLSearchParams();
    params.set("tab", nextTab);
    if (seasonId) params.set("season", seasonId);
    if (groupId) params.set("group", groupId);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <nav className="flex gap-1 rounded-lg border border-border-strong bg-surface p-1 shadow-inner shadow-black/40">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={buildHref(t.key)}
                className={`rounded px-3.5 py-1.5 text-sm font-medium tracking-wide transition ${
                  tab === t.key
                    ? "bg-accent text-background shadow-sm"
                    : "text-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          {showMemberLinks &&
          (permission === "enter" || permission === "admin") ? (
            <Link
              href={`/l/${leagueSlug}/enter`}
              className="rounded-lg border border-green/40 bg-green-soft px-3.5 py-1.5 text-sm font-medium text-green transition hover:bg-green/20"
            >
              Enter results
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Season"
            name="season"
            value={seasonId}
            basePath={basePath}
            tab={tab}
            groupId={groupId}
            options={[
              { value: "", label: "All time" },
              ...seasons.map((s) => ({
                value: s.id,
                label: s.archived ? `${s.name} (archived)` : s.name,
              })),
            ]}
          />
          <FilterSelect
            label="Group"
            name="group"
            value={groupId}
            basePath={basePath}
            tab={tab}
            seasonId={seasonId}
            options={[
              { value: "", label: "All groups" },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
        </div>
      </div>

      {tab === "standings" ? (
        <TeamStandings leagueId={league.id} filter={filter} />
      ) : null}
      {tab === "players" ? (
        <PlayerStandings
          leagueId={league.id}
          filter={filter}
          playerBasePath={`${basePath}/player`}
        />
      ) : null}
      {tab === "highscores" ? (
        <HighScores
          leagueId={league.id}
          filter={filter}
          playerBasePath={`${basePath}/player`}
        />
      ) : null}
      {tab === "results" ? <Results leagueId={league.id} filter={filter} /> : null}
    </div>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
  basePath,
  tab,
  seasonId,
  groupId,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  basePath: string;
  tab: string;
  seasonId?: string;
  groupId?: string;
}) {
  return (
    <form method="get" action={basePath} className="flex items-center gap-1.5">
      <input type="hidden" name="tab" value={tab} />
      {seasonId !== undefined ? (
        <input type="hidden" name="season" value={seasonId} />
      ) : null}
      {groupId !== undefined ? (
        <input type="hidden" name="group" value={groupId} />
      ) : null}
      <label htmlFor={name} className="sr-only">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={value}
        className="rounded border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-muted transition hover:border-accent hover:text-accent"
      >
        Apply
      </button>
    </form>
  );
}

async function TeamStandings({
  leagueId,
  filter,
}: {
  leagueId: string;
  filter: { seasonId: string | null; groupId: string | null };
}) {
  const standings = await getTeamStandings({ leagueId, ...filter });
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { teamRankingMode: true },
  });

  if (standings.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No matches recorded yet"
          description="Team standings appear once matches have been entered."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Team standings"
        description={
          league?.teamRankingMode === "WINS"
            ? "Ranked by wins and losses."
            : "Ranked by points earned."
        }
      />
      <Table
        head={
          <>
            <Th className="w-12">#</Th>
            <Th>Team</Th>
            <Th>Group</Th>
            <Th numeric>Points</Th>
            <Th numeric>W</Th>
            <Th numeric>L</Th>
            <Th numeric>Legs</Th>
          </>
        }
      >
        {standings.map((s, i) => (
          <tr key={s.teamId} className="pub-row">
            <Td>
              <Rank position={i + 1} />
            </Td>
            <Td className="font-medium">{s.teamName}</Td>
            <Td className="text-muted">{s.groupName}</Td>
            <Td numeric className="font-semibold text-accent">
              {s.points}
            </Td>
            <Td numeric>{s.wins}</Td>
            <Td numeric>{s.losses}</Td>
            <Td numeric className="text-muted">
              {s.legsWon}-{s.legsLost}
            </Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

async function PlayerStandings({
  leagueId,
  filter,
  playerBasePath,
}: {
  leagueId: string;
  filter: { seasonId: string | null; groupId: string | null };
  playerBasePath: string;
}) {
  const standings = await getPlayerStandings({ leagueId, ...filter });

  if (standings.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No player results yet"
          description="Player stats appear once matches have been entered."
        />
      </Card>
    );
  }

  const params = new URLSearchParams();
  if (filter.seasonId) params.set("season", filter.seasonId);
  if (filter.groupId) params.set("group", filter.groupId);
  const query = params.toString();

  return (
    <Card>
      <CardHeader
        title="Player standings"
        description="Points, matches played and leg record. Click a player for their full record."
      />
      <Table
        head={
          <>
            <Th className="w-12">#</Th>
            <Th>Player</Th>
            <Th numeric>Points</Th>
            <Th numeric>Matches</Th>
            <Th numeric>Legs won</Th>
            <Th numeric>Legs lost</Th>
          </>
        }
      >
        {standings.map((s, i) => (
          <tr key={s.playerId} className="pub-row">
            <Td>
              <Rank position={i + 1} />
            </Td>
            <Td className="font-medium">
              <Link
                href={`${playerBasePath}/${s.playerId}${query ? `?${query}` : ""}`}
                className="text-accent transition hover:text-foreground hover:underline"
              >
                {s.playerName}
              </Link>
            </Td>
            <Td numeric className="font-semibold text-accent">
              {s.points}
            </Td>
            <Td numeric>{s.matchesPlayed}</Td>
            <Td numeric>{s.legsWon}</Td>
            <Td numeric className="text-muted">{s.legsLost}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

async function HighScores({
  leagueId,
  filter,
  playerBasePath,
}: {
  leagueId: string;
  filter: { seasonId: string | null; groupId: string | null };
  playerBasePath: string;
}) {
  const boards = await getStatBoards({ leagueId, ...filter });
  const withEntries = boards.filter((b) => b.entries.length > 0);

  if (withEntries.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No high scores recorded yet"
          description="High score boards fill in as stats are entered."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {withEntries.map((board) => (
        <Card key={board.statDefId}>
          <CardHeader
            title={board.name}
            description={
              board.entryType === "VALUE"
                ? "Highest value recorded"
                : "Most hits"
            }
          />
          <Table
            head={
              <>
                <Th className="w-12">#</Th>
                <Th>Player</Th>
                <Th numeric>
                  {board.entryType === "VALUE" ? "Value" : "Total"}
                </Th>
              </>
            }
          >
            {board.entries.slice(0, 10).map((e, i) => (
              <tr key={e.playerId} className="pub-row">
                <Td>
                  <Rank position={i + 1} />
                </Td>
                <Td className="font-medium">
                  <Link
                    href={`${playerBasePath}/${e.playerId}`}
                    className="text-accent transition hover:text-foreground hover:underline"
                  >
                    {e.playerName}
                  </Link>
                </Td>
                <Td numeric className="font-semibold text-accent">
                  {e.total}
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      ))}
    </div>
  );
}

async function Results({
  leagueId,
  filter,
}: {
  leagueId: string;
  filter: { seasonId: string | null; groupId: string | null };
}) {
  const nights = await prisma.night.findMany({
    where: {
      leagueId,
      ...(filter.groupId ? { groupId: filter.groupId } : {}),
      ...(filter.seasonId ? { seasonId: filter.seasonId } : {}),
    },
    orderBy: { date: "desc" },
    include: {
      group: { select: { name: true } },
      matches: {
        orderBy: { sortOrder: "asc" },
        include: {
          sideA: { select: { name: true } },
          sideB: { select: { name: true } },
          participants: {
            select: { side: true, player: { select: { name: true } } },
            orderBy: { position: "asc" },
          },
          legs: { select: { index: true, winningSide: true } },
          points: { select: { points: true, player: { select: { name: true } } } },
        },
      },
    },
  });

  if (nights.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No results yet"
          description="Match results appear here once entered."
        />
      </Card>
    );
  }

  return (
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
          <div className="divide-y divide-border">
            {night.matches.map((match) => {
              const sideA = match.participants.filter((p) => p.side === 1);
              const sideB = match.participants.filter((p) => p.side === 2);
              const aLegs = match.legs.filter((l) => l.winningSide === 1).length;
              const bLegs = match.legs.filter((l) => l.winningSide === 2).length;

              const aPoints = match.points
                .filter((p) => sideA.some((s) => s.player.name === p.player.name))
                .reduce((sum, p) => sum + p.points, 0);
              const bPoints = match.points
                .filter((p) => sideB.some((s) => s.player.name === p.player.name))
                .reduce((sum, p) => sum + p.points, 0);

              return (
                <div
                  key={match.id}
                  className="pub-row flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {match.name ?? "Match"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {sideA.map((p) => p.player.name).join(", ") || "—"} vs{" "}
                      {sideB.map((p) => p.player.name).join(", ") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{aPoints} pts</Badge>
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {aLegs} - {bLegs}
                    </span>
                    <Badge tone="muted">{bPoints} pts</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
