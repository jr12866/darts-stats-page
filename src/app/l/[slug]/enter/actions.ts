"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canEnter } from "@/lib/permissions";
import { logChange } from "@/lib/audit";

/**
 * Night and match creation.
 *
 * A night is an instance of a group's template on a date. Matches are created
 * from the template's match specs, then the scorer fills in the players.
 */

export type EntryState = { error?: string; ok?: string };

const NightSchema = z.object({
  groupId: z.string().min(1),
  date: z.string().min(1),
  seasonId: z.string().optional(),
});

export async function createNight(
  leagueSlug: string,
  _prev: EntryState | undefined,
  formData: FormData,
): Promise<EntryState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true, slug: true },
  });
  if (!league) return { error: "League not found." };

  const allowed = await canEnter(league.id, user);
  if (!allowed) return { error: "Not permitted." };

  const parsed = NightSchema.safeParse({
    groupId: formData.get("groupId"),
    date: formData.get("date"),
    seasonId: formData.get("seasonId") || undefined,
  });
  if (!parsed.success) return { error: "Choose a group and a date." };

  const group = await prisma.group.findFirst({
    where: { id: parsed.data.groupId, leagueId: league.id },
    include: { template: { include: { matchSpecs: true } } },
  });
  if (!group) return { error: "Group not found." };

  if (!group.template) {
    return { error: "This group has no template yet. Add one in admin first." };
  }

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) return { error: "Invalid date." };

  const night = await prisma.night.create({
    data: {
      leagueId: league.id,
      groupId: group.id,
      templateId: group.template.id,
      seasonId: parsed.data.seasonId || null,
      date,
    },
  });

  // Create one match per template spec so the scorer fills in the players.
  for (const spec of group.template.matchSpecs) {
    await prisma.match.create({
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
        legs: {
          create: Array.from({ length: spec.legCount }, (_, i) => ({ index: i })),
        },
      },
    });
  }

  revalidatePath(`/l/${league.slug}/enter`);
  redirect(`/l/${league.slug}/enter`);
}

const ParticipantsSchema = z.object({
  sideA: z.array(z.string()),
  sideB: z.array(z.string()),
});

/**
 * Sets the players taking part on each side of a match. This is how
 * substitutes are handled: any league player can be added to either side.
 */
export async function setParticipants(
  leagueSlug: string,
  matchId: string,
  _prev: EntryState | undefined,
  formData: FormData,
): Promise<EntryState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const match = await prisma.match.findFirst({
    where: { id: matchId, night: { league: { slug: leagueSlug } } },
    select: {
      id: true,
      playersPerSide: true,
      night: { select: { leagueId: true, league: { select: { slug: true } } } },
    },
  });
  if (!match) return { error: "Match not found." };

  const allowed = await canEnter(match.night.leagueId, user);
  if (!allowed) return { error: "Not permitted." };

  const parsed = ParticipantsSchema.safeParse({
    sideA: formData.getAll("sideA").map(String).filter(Boolean),
    sideB: formData.getAll("sideB").map(String).filter(Boolean),
  });
  if (!parsed.success) return { error: "Select the players taking part." };

  const allIds = [...parsed.data.sideA, ...parsed.data.sideB];
  if (new Set(allIds).size !== allIds.length) {
    return { error: "A player cannot be on both sides." };
  }

  const validPlayers = await prisma.player.findMany({
    where: { id: { in: allIds }, leagueId: match.night.leagueId },
    select: { id: true },
  });
  if (validPlayers.length !== allIds.length) {
    return { error: "One of those players is not in this league." };
  }

  const existing = await prisma.matchParticipant.findMany({
    where: { matchId: match.id },
    include: { player: { select: { name: true } } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.matchParticipant.deleteMany({ where: { matchId: match.id } });

    for (const [side, players] of [
      [1, parsed.data.sideA],
      [2, parsed.data.sideB],
    ] as const) {
      for (const [position, playerId] of players.entries()) {
        await tx.matchParticipant.create({
          data: { matchId: match.id, playerId, side, position },
        });
      }
    }
  });

  // Log the change only when the line-up actually differs from what was
  // recorded before.
  const before = existing
    .map((p) => `${p.player.name} (side ${p.side})`)
    .sort();
  const afterNames = await prisma.player.findMany({
    where: { id: { in: allIds } },
    select: { id: true, name: true },
  });
  const sideOf = new Map<string, number>();
  for (const [side, players] of [
    [1, parsed.data.sideA],
    [2, parsed.data.sideB],
  ] as const) {
    for (const playerId of players) sideOf.set(playerId, side);
  }
  const after = afterNames
    .map((p) => `${p.name} (side ${sideOf.get(p.id)})`)
    .sort();

  if (before.join("|") !== after.join("|")) {
    await logChange({
      leagueId: match.night.leagueId,
      userId: user.id,
      entity: "MatchParticipant",
      entityId: match.id,
      field: "lineup",
      oldValue: before.join(", ") || "none",
      newValue: after.join(", ") || "none",
    });
  }

  revalidatePath(`/l/${leagueSlug}/enter/${match.id}`);
  refresh();
  return { ok: "Players saved." };
}
