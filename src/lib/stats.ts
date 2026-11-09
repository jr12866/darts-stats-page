import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Query helpers for the dashboard.
 *
 * All leaderboards and standings are computed on the fly from the recorded
 * match data. Nothing is stored as a running total, so correcting a record
 * immediately corrects every derived figure.
 */

export type SeasonFilter = {
  leagueId: string;
  seasonId?: string | null;
  groupId?: string | null;
};

/**
 * Builds a night filter for a league, optionally narrowed to a season and/or
 * a group. Season filtering uses the night date against the season's start
 * and end dates when they are set, otherwise it uses the explicit season link.
 */
function nightWhere(f: SeasonFilter): Prisma.NightWhereInput {
  const where: Prisma.NightWhereInput = { leagueId: f.leagueId };

  if (f.groupId) {
    where.groupId = f.groupId;
  }

  if (f.seasonId) {
    where.seasonId = f.seasonId;
  }

  return where;
}

// ---------------------------------------------------------------------------
// Stat leaderboards
// ---------------------------------------------------------------------------

export type StatBoardEntry = {
  playerId: string;
  playerName: string;
  total: number;
  count: number;
};

export type StatBoard = {
  statDefId: string;
  name: string;
  entryType: "VALUE" | "COUNT";
  mode: string;
  entries: StatBoardEntry[];
};

/**
 * Builds a leaderboard per configured stat.
 *
 * VALUE stats rank by the highest single value recorded (e.g. "highest out").
 * COUNT stats rank by the summed count (e.g. "most 100+ scores").
 */
export async function getStatBoards(f: SeasonFilter): Promise<StatBoard[]> {
  const statDefs = await prisma.statDef.findMany({
    where: { leagueId: f.leagueId, retired: false },
    orderBy: { sortOrder: "asc" },
  });

  if (statDefs.length === 0) return [];

  const nights = await prisma.night.findMany({
    where: nightWhere(f),
    select: { id: true },
  });
  const nightIds = nights.map((n) => n.id);

  if (nightIds.length === 0) {
    return statDefs.map((s) => ({
      statDefId: s.id,
      name: s.name,
      entryType: s.entryType,
      mode: s.mode,
      entries: [],
    }));
  }

  const events = await prisma.statEvent.findMany({
    where: {
      statDefId: { in: statDefs.map((s) => s.id) },
      leg: { match: { nightId: { in: nightIds } } },
    },
    select: {
      statDefId: true,
      value: true,
      player: { select: { id: true, name: true } },
    },
  });

  return statDefs.map((stat) => {
    const statEvents = events.filter((e) => e.statDefId === stat.id);

    if (stat.entryType === "VALUE") {
      // Rank by the single highest value. Ties share the same total so the
      // board reads "X, Y and Z are joint holders".
      const best = new Map<string, { name: string; value: number }>();
      for (const e of statEvents) {
        const current = best.get(e.player.id);
        if (!current || e.value > current.value) {
          best.set(e.player.id, { name: e.player.name, value: e.value });
        }
      }
      const entries = [...best.entries()]
        .map(([playerId, v]) => ({
          playerId,
          playerName: v.name,
          total: v.value,
          count: 1,
        }))
        .sort((a, b) => b.total - a.total || a.playerName.localeCompare(b.playerName));

      return {
        statDefId: stat.id,
        name: stat.name,
        entryType: stat.entryType,
        mode: stat.mode,
        entries,
      };
    }

    // COUNT: sum the values per player.
    const totals = new Map<string, { name: string; total: number; count: number }>();
    for (const e of statEvents) {
      const current = totals.get(e.player.id) ?? {
        name: e.player.name,
        total: 0,
        count: 0,
      };
      current.total += e.value;
      current.count += 1;
      totals.set(e.player.id, current);
    }
    const entries = [...totals.entries()]
      .map(([playerId, v]) => ({
        playerId,
        playerName: v.name,
        total: v.total,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total || a.playerName.localeCompare(b.playerName));

    return {
      statDefId: stat.id,
      name: stat.name,
      entryType: stat.entryType,
      mode: stat.mode,
      entries,
    };
  });
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export type PlayerStanding = {
  playerId: string;
  playerName: string;
  teamName: string | null;
  points: number;
  matchesPlayed: number;
  legsWon: number;
  legsLost: number;
};

export type TeamStanding = {
  teamId: string;
  teamName: string;
  groupName: string;
  points: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  legsWon: number;
  legsLost: number;
};

/** Individual standings: points, matches played and leg win/loss record. */
export async function getPlayerStandings(
  f: SeasonFilter,
): Promise<PlayerStanding[]> {
  const matches = await prisma.match.findMany({
    where: { night: nightWhere(f) },
    select: {
      id: true,
      legCount: true,
      legs: { select: { winningSide: true } },
      participants: {
        select: { playerId: true, side: true, player: { select: { name: true } } },
      },
      points: { select: { playerId: true, points: true } },
    },
  });

  const byPlayer = new Map<
    string,
    {
      name: string;
      points: number;
      matchesPlayed: number;
      legsWon: number;
      legsLost: number;
    }
  >();

  for (const match of matches) {
    const pointsByPlayer = new Map(match.points.map((p) => [p.playerId, p.points]));

    for (const participant of match.participants) {
      const entry = byPlayer.get(participant.playerId) ?? {
        name: participant.player.name,
        points: 0,
        matchesPlayed: 0,
        legsWon: 0,
        legsLost: 0,
      };

      entry.points += pointsByPlayer.get(participant.playerId) ?? 0;
      entry.matchesPlayed += 1;

      for (const leg of match.legs) {
        if (leg.winningSide === null) continue;
        if (leg.winningSide === participant.side) {
          entry.legsWon += 1;
        } else {
          entry.legsLost += 1;
        }
      }

      byPlayer.set(participant.playerId, entry);
    }
  }

  return [...byPlayer.entries()]
    .map(([playerId, v]) => ({
      playerId,
      playerName: v.name,
      teamName: null,
      points: v.points,
      matchesPlayed: v.matchesPlayed,
      legsWon: v.legsWon,
      legsLost: v.legsLost,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.legsWon - a.legsWon ||
        a.playerName.localeCompare(b.playerName),
    );
}

/**
 * Team standings. Team points are the sum of their members' points; win/loss
 * is derived from legs won across the team's matches.
 */
export async function getTeamStandings(f: SeasonFilter): Promise<TeamStanding[]> {
  const matches = await prisma.match.findMany({
    where: { night: nightWhere(f) },
    select: {
      id: true,
      sideAId: true,
      sideBId: true,
      legs: { select: { winningSide: true } },
      participants: { select: { playerId: true, side: true } },
      points: { select: { playerId: true, points: true } },
    },
  });

  const byTeam = new Map<
    string,
    { wins: number; losses: number; legsWon: number; legsLost: number; points: number }
  >();

  const ensure = (teamId: string | null) => {
    if (!teamId) return null;
    if (!byTeam.has(teamId)) {
      byTeam.set(teamId, {
        wins: 0,
        losses: 0,
        legsWon: 0,
        legsLost: 0,
        points: 0,
      });
    }
    return byTeam.get(teamId)!;
  };

  for (const match of matches) {
    const a = ensure(match.sideAId);
    const b = ensure(match.sideBId);
    if (!a || !b) continue;

    // Points: sum of the points entered for players on each side.
    const sidePoints: Record<number, number> = { 1: 0, 2: 0 };
    const playerSide = new Map(match.participants.map((p) => [p.playerId, p.side]));
    for (const p of match.points) {
      const side = playerSide.get(p.playerId);
      if (side) sidePoints[side] += p.points;
    }
    a.points += sidePoints[1];
    b.points += sidePoints[2];

    let aLegs = 0;
    let bLegs = 0;
    for (const leg of match.legs) {
      if (leg.winningSide === null) continue;
      if (leg.winningSide === 1) aLegs += 1;
      else bLegs += 1;
    }
    a.legsWon += aLegs;
    a.legsLost += bLegs;
    b.legsWon += bLegs;
    b.legsLost += aLegs;

    if (aLegs > bLegs) a.wins += 1;
    else if (bLegs > aLegs) b.wins += 1;
  }

  const teams = await prisma.team.findMany({
    where: { group: { leagueId: f.leagueId } },
    select: { id: true, name: true, group: { select: { name: true } } },
  });

  return teams
    .map((team) => {
      const s = byTeam.get(team.id);
      return {
        teamId: team.id,
        teamName: team.name,
        groupName: team.group.name,
        points: s?.points ?? 0,
        matchesPlayed: (s?.wins ?? 0) + (s?.losses ?? 0),
        wins: s?.wins ?? 0,
        losses: s?.losses ?? 0,
        legsWon: s?.legsWon ?? 0,
        legsLost: s?.legsLost ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        a.teamName.localeCompare(b.teamName),
    );
}

// ---------------------------------------------------------------------------
// Player stat card
// ---------------------------------------------------------------------------

export type PlayerStatCard = {
  playerId: string;
  playerName: string;
  points: number;
  matchesPlayed: number;
  legsWon: number;
  legsLost: number;
  stats: {
    statDefId: string;
    name: string;
    entryType: "VALUE" | "COUNT";
    total: number;
    best: number | null;
  }[];
};

/** Everything the league has recorded for one player. */
export async function getPlayerCard(
  leagueId: string,
  playerId: string,
  f: Omit<SeasonFilter, "leagueId">,
): Promise<PlayerStatCard | null> {
  const player = await prisma.player.findFirst({
    where: { id: playerId, leagueId },
    select: { id: true, name: true },
  });
  if (!player) return null;

  const standings = await getPlayerStandings({ leagueId, ...f });
  const standing = standings.find((s) => s.playerId === playerId);

  const boards = await getStatBoards({ leagueId, ...f });
  const stats = boards
    .map((board) => {
      const entry = board.entries.find((e) => e.playerId === playerId);
      if (!entry) return null;
      return {
        statDefId: board.statDefId,
        name: board.name,
        entryType: board.entryType,
        total: entry.total,
        best: board.entryType === "VALUE" ? entry.total : null,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return {
    playerId: player.id,
    playerName: player.name,
    points: standing?.points ?? 0,
    matchesPlayed: standing?.matchesPlayed ?? 0,
    legsWon: standing?.legsWon ?? 0,
    legsLost: standing?.legsLost ?? 0,
    stats,
  };
}
