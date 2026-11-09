import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import {
  CheckoutRule,
  GameMode,
  PrismaClient,
  StatEntryType,
  StatMode,
} from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding...");

  const password = await bcrypt.hash("dartleague", 10);

  // Platform admin (site owner).
  const owner = await prisma.user.upsert({
    where: { email: "owner@dartleague.test" },
    update: {},
    create: {
      email: "owner@dartleague.test",
      name: "Site Owner",
      passwordHash: password,
      isPlatformAdmin: true,
    },
  });

  // League admin.
  const leagueAdmin = await prisma.user.upsert({
    where: { email: "admin@dartleague.test" },
    update: {},
    create: {
      email: "admin@dartleague.test",
      name: "League Admin",
      passwordHash: password,
      isPlatformAdmin: false,
    },
  });

  // Scorer.
  const scorer = await prisma.user.upsert({
    where: { email: "scorer@dartleague.test" },
    update: {},
    create: {
      email: "scorer@dartleague.test",
      name: "Scorer",
      passwordHash: password,
      isPlatformAdmin: false,
    },
  });

  const league = await prisma.league.upsert({
    where: { slug: "demo-league" },
    update: {},
    create: {
      slug: "demo-league",
      name: "Demo Dart League",
      teamRankingMode: "POINTS",
    },
  });

  await prisma.leagueMember.upsert({
    where: {
      leagueId_userId: { leagueId: league.id, userId: owner.id },
    },
    update: {},
    create: {
      leagueId: league.id,
      userId: owner.id,
      isLeagueAdmin: true,
      isScorer: true,
    },
  });

  await prisma.leagueMember.upsert({
    where: {
      leagueId_userId: { leagueId: league.id, userId: leagueAdmin.id },
    },
    update: {},
    create: {
      leagueId: league.id,
      userId: leagueAdmin.id,
      isLeagueAdmin: true,
      isScorer: true,
    },
  });

  await prisma.leagueMember.upsert({
    where: {
      leagueId_userId: { leagueId: league.id, userId: scorer.id },
    },
    update: {},
    create: {
      leagueId: league.id,
      userId: scorer.id,
      isScorer: true,
    },
  });

  // Season.
  const season = await prisma.season.findFirst({
    where: { leagueId: league.id, name: "2026" },
  });
  const seasonId =
    season?.id ??
    (await prisma.season.create({
      data: { leagueId: league.id, name: "2026" },
    })).id;

  // Players.
  const playerNames = [
    "Alex Rivera",
    "Beth Chen",
    "Casey Novak",
    "Dev Patel",
    "Emery Walsh",
    "Finley Brooks",
    "Gray Ortiz",
    "Harper Kim",
  ];

  const players: Record<string, { id: string }> = {};
  for (const name of playerNames) {
    const existing = await prisma.player.findFirst({
      where: { leagueId: league.id, name },
    });
    players[name] =
      existing ??
      (await prisma.player.create({ data: { leagueId: league.id, name } }));
  }

  // Groups + teams.
  const groupDefs: {
    name: string;
    teams: string[];
    roster: [string, string[]][];
  }[] = [
    {
      name: "Division 1",
      teams: ["Team Alpha", "Team Bravo"],
      roster: [
        ["Team Alpha", ["Alex Rivera", "Beth Chen", "Casey Novak", "Dev Patel"]],
        ["Team Bravo", ["Emery Walsh", "Finley Brooks", "Gray Ortiz", "Harper Kim"]],
      ],
    },
  ];

  for (const groupDef of groupDefs) {
    let group = await prisma.group.findFirst({
      where: { leagueId: league.id, name: groupDef.name },
    });
    group ??=
      (await prisma.group.create({
        data: { leagueId: league.id, name: groupDef.name },
      })) as NonNullable<typeof group>;

    for (const [teamName, rosterNames] of groupDef.roster) {
      let team = await prisma.team.findFirst({
        where: { groupId: group.id, name: teamName },
      });
      team ??=
        (await prisma.team.create({
          data: { groupId: group.id, name: teamName },
        })) as NonNullable<typeof team>;

      for (const playerName of rosterNames) {
        const player = players[playerName];
        const existing = await prisma.teamPlayer.findFirst({
          where: { teamId: team.id, playerId: player.id },
        });
        if (!existing) {
          await prisma.teamPlayer.create({
            data: { teamId: team.id, playerId: player.id },
          });
        }
      }
    }
  }

  // Template for the group: 4 singles + doubles + team rotation.
  const group = (await prisma.group.findFirst({
    where: { leagueId: league.id, name: "Division 1" },
  }))!;

  let template = await prisma.template.findFirst({
    where: { groupId: group.id },
  });
  template ??=
    (await prisma.template.create({
      data: { groupId: group.id, name: "Division 1 League Night" },
    })) as NonNullable<typeof template>;

  const specCount = await prisma.matchSpec.count({
    where: { templateId: template.id },
  });

  if (specCount === 0) {
    await prisma.matchSpec.createMany({
      data: [
        {
          templateId: template.id,
          name: "Singles 501",
          sortOrder: 0,
          mode: GameMode.ZERO1,
          playersPerSide: 1,
          legCount: 3,
          checkoutRule: CheckoutRule.DOUBLE_OUT,
          startScore: 501,
        },
        {
          templateId: template.id,
          name: "Doubles 501",
          sortOrder: 1,
          mode: GameMode.ZERO1,
          playersPerSide: 2,
          legCount: 3,
          checkoutRule: CheckoutRule.DOUBLE_OUT,
          startScore: 501,
        },
        {
          templateId: template.id,
          name: "Doubles Cricket",
          sortOrder: 2,
          mode: GameMode.CRICKET,
          playersPerSide: 2,
          legCount: 3,
          cricketTarget: 15,
        },
        {
          templateId: template.id,
          name: "Team 801",
          sortOrder: 3,
          mode: GameMode.ZERO1,
          playersPerSide: 4,
          rotation: true,
          legCount: 1,
          checkoutRule: CheckoutRule.DOUBLE_OUT,
          startScore: 801,
        },
      ],
    });
  }

  // Stat definitions - the league decides what it tracks.
  const statDefs = [
    { name: "High Out", mode: StatMode.ZERO1, entryType: StatEntryType.VALUE },
    { name: "High In", mode: StatMode.ZERO1, entryType: StatEntryType.VALUE },
    { name: "100+", mode: StatMode.ZERO1, entryType: StatEntryType.COUNT },
    { name: "140+", mode: StatMode.ZERO1, entryType: StatEntryType.COUNT },
    { name: "180", mode: StatMode.ZERO1, entryType: StatEntryType.COUNT },
    { name: "5 Marks", mode: StatMode.CRICKET, entryType: StatEntryType.COUNT },
    { name: "6 Marks", mode: StatMode.CRICKET, entryType: StatEntryType.COUNT },
    { name: "3+ Bulls", mode: StatMode.CRICKET, entryType: StatEntryType.COUNT },
  ];

  for (const [i, stat] of statDefs.entries()) {
    const existing = await prisma.statDef.findFirst({
      where: { leagueId: league.id, name: stat.name },
    });
    if (!existing) {
      await prisma.statDef.create({
        data: {
          leagueId: league.id,
          name: stat.name,
          mode: stat.mode,
          entryType: stat.entryType,
          sortOrder: i,
        },
      });
    }
  }

  // A night with a match so the dashboard has something to show.
  const nightCount = await prisma.night.count({
    where: { leagueId: league.id },
  });

  if (nightCount === 0) {
    const specs = await prisma.matchSpec.findMany({
      where: { templateId: template.id },
      orderBy: { sortOrder: "asc" },
    });
    const teams = await prisma.team.findMany({
      where: { groupId: group.id },
      orderBy: { name: "asc" },
    });
    const alpha = teams.find((t) => t.name === "Team Alpha")!;
    const bravo = teams.find((t) => t.name === "Team Bravo")!;

    const night = await prisma.night.create({
      data: {
        leagueId: league.id,
        groupId: group.id,
        templateId: template.id,
        seasonId,
        date: new Date("2026-10-02T19:00:00Z"),
      },
    });

    const singlesSpec = specs.find((s) => s.name === "Singles 501")!;
    const alphaRoster = await prisma.teamPlayer.findMany({
      where: { teamId: alpha.id },
    });
    const bravoRoster = await prisma.teamPlayer.findMany({
      where: { teamId: bravo.id },
    });

    const makeMatch = async (
      spec: (typeof specs)[number],
      sideAPlayers: string[],
      sideBPlayers: string[],
      legWinners: number[],
    ) => {
      const match = await prisma.match.create({
        data: {
          nightId: night.id,
          matchSpecId: spec.id,
          sortOrder: spec.sortOrder,
          name: spec.name,
          mode: spec.mode,
          playersPerSide: spec.playersPerSide,
          rotation: spec.rotation,
          legCount: spec.legCount,
          checkoutRule: spec.checkoutRule,
          cricketTarget: spec.cricketTarget,
          startScore: spec.startScore,
          sideAId: alpha.id,
          sideBId: bravo.id,
        },
      });

      for (const [i, pid] of sideAPlayers.entries()) {
        await prisma.matchParticipant.create({
          data: { matchId: match.id, playerId: pid, side: 1, position: i },
        });
      }
      for (const [i, pid] of sideBPlayers.entries()) {
        await prisma.matchParticipant.create({
          data: { matchId: match.id, playerId: pid, side: 2, position: i },
        });
      }

      for (let i = 0; i < legWinners.length; i++) {
        await prisma.leg.create({
          data: { matchId: match.id, index: i, winningSide: legWinners[i] },
        });
      }

      return match;
    };

    // Singles matches: each Alpha player vs a Bravo player.
    for (let i = 0; i < 4; i++) {
      const a = alphaRoster[i];
      const b = bravoRoster[i];
      if (!a || !b) continue;
      await makeMatch(
        singlesSpec,
        [a.playerId],
        [b.playerId],
        i % 2 === 0 ? [1, 2, 1] : [2, 1, 2],
      );
    }

    // Points for the singles matches.
    for (const m of await prisma.match.findMany({ where: { nightId: night.id } })) {
      const participants = await prisma.matchParticipant.findMany({
        where: { matchId: m.id },
      });
      for (const p of participants) {
        const legs = await prisma.leg.findMany({
          where: { matchId: m.id, winningSide: p.side },
        });
        await prisma.pointsEntry.create({
          data: {
            leagueId: league.id,
            matchId: m.id,
            playerId: p.playerId,
            points: legs.length * 3,
          },
        });
      }
    }
  }

  console.log("Seed complete.");
  console.log("  Platform admin: owner@dartleague.test / dartleague");
  console.log("  League admin:   admin@dartleague.test / dartleague");
  console.log("  Scorer:         scorer@dartleague.test / dartleague");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
