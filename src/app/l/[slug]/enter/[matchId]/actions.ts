"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canEnter, canCorrect } from "@/lib/permissions";
import { logChange } from "@/lib/audit";

/**
 * Match entry actions.
 *
 * Scorers may enter results and points. Only league admins may correct
 * records that already exist. Every action re-reads the league, match and
 * player from the database and verifies the caller's permission against that
 * league, so nothing is trusted from the submitted form.
 */

export type EntryState = { error?: string; ok?: string };

type Ctx = {
  leagueId: string;
  leagueSlug: string;
  matchId: string;
  userId: string;
};

async function requireMatchAccess(
  leagueSlug: string,
  matchId: string,
  mode: "enter" | "correct",
): Promise<Ctx> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      night: { league: { slug: leagueSlug } },
    },
    select: {
      id: true,
      night: { select: { id: true, leagueId: true, league: { select: { slug: true } } } },
    },
  });
  if (!match) throw new Error("Match not found");

  const { leagueId, league } = match.night;

  const allowed =
    mode === "correct"
      ? await canCorrect(leagueId, user)
      : await canEnter(leagueId, user);

  if (!allowed) throw new Error("Not permitted");

  return {
    leagueId,
    leagueSlug: league.slug,
    matchId: match.id,
    userId: user.id,
  };
}

// ---------------------------------------------------------------------------
// Legs
// ---------------------------------------------------------------------------

const LegSchema = z.object({
  winningSide: z.coerce.number().int().min(1).max(2),
});

export async function setLegResult(
  leagueSlug: string,
  matchId: string,
  _prev: EntryState | undefined,
  formData: FormData,
): Promise<EntryState> {
  const ctx = await requireMatchAccess(leagueSlug, matchId, "enter");

  const index = Number(formData.get("index"));
  const parsed = LegSchema.safeParse({ winningSide: formData.get("winningSide") });
  if (!parsed.success) return { error: "Pick which side won the leg." };

  const leg = await prisma.leg.findFirst({
    where: { matchId: ctx.matchId, index },
  });
  if (!leg) return { error: "Leg not found." };

  const previous = leg.winningSide;

  await prisma.leg.update({
    where: { id: leg.id },
    data: { winningSide: parsed.data.winningSide },
  });

  // Changing a result that was already recorded is a correction.
  if (previous !== null && previous !== parsed.data.winningSide) {
    await logChange({
      leagueId: ctx.leagueId,
      userId: ctx.userId,
      entity: "Leg",
      entityId: leg.id,
      field: "winningSide",
      oldValue: previous,
      newValue: parsed.data.winningSide,
    });
  }

  revalidatePath(`/l/${ctx.leagueSlug}/enter/${ctx.matchId}`);
  refresh();
  return { ok: `Leg ${index + 1} saved.` };
}

export async function clearLegResult(
  leagueSlug: string,
  matchId: string,
  _prev: EntryState | undefined,
  formData: FormData,
): Promise<EntryState> {
  const ctx = await requireMatchAccess(leagueSlug, matchId, "correct");

  const index = Number(formData.get("index"));
  const leg = await prisma.leg.findFirst({
    where: { matchId: ctx.matchId, index },
  });
  if (!leg) return { error: "Leg not found." };

  const previous = leg.winningSide;

  await prisma.leg.update({ where: { id: leg.id }, data: { winningSide: null } });

  await logChange({
    leagueId: ctx.leagueId,
    userId: ctx.userId,
    entity: "Leg",
    entityId: leg.id,
    field: "winningSide",
    oldValue: previous,
    newValue: null,
  });

  revalidatePath(`/l/${ctx.leagueSlug}/enter/${ctx.matchId}`);
  refresh();
  return { ok: `Leg ${index + 1} cleared.` };
}

// ---------------------------------------------------------------------------
// Stat events
// ---------------------------------------------------------------------------

const StatEventSchema = z.object({
  legIndex: z.coerce.number().int().min(0),
  playerId: z.string().min(1),
  statDefId: z.string().min(1),
  value: z.coerce.number().int().min(0).max(1000),
});

export async function addStatEvent(
  leagueSlug: string,
  matchId: string,
  _prev: EntryState | undefined,
  formData: FormData,
): Promise<EntryState> {
  const ctx = await requireMatchAccess(leagueSlug, matchId, "enter");

  const parsed = StatEventSchema.safeParse({
    legIndex: formData.get("legIndex"),
    playerId: formData.get("playerId"),
    statDefId: formData.get("statDefId"),
    value: formData.get("value"),
  });
  if (!parsed.success) return { error: "Enter a player, a stat and a value." };

  // The leg must belong to this match.
  const leg = await prisma.leg.findFirst({
    where: { matchId: ctx.matchId, index: parsed.data.legIndex },
  });
  if (!leg) return { error: "Leg not found." };

  // The stat must belong to this league and not be retired.
  const statDef = await prisma.statDef.findFirst({
    where: {
      id: parsed.data.statDefId,
      leagueId: ctx.leagueId,
      retired: false,
    },
  });
  if (!statDef) return { error: "That stat is not available." };

  // The player must be taking part in this match.
  const participant = await prisma.matchParticipant.findFirst({
    where: { matchId: ctx.matchId, playerId: parsed.data.playerId },
  });
  if (!participant) return { error: "That player is not in this match." };

  await prisma.statEvent.create({
    data: {
      legId: leg.id,
      playerId: parsed.data.playerId,
      statDefId: statDef.id,
      value: parsed.data.value,
    },
  });

  revalidatePath(`/l/${ctx.leagueSlug}/enter/${ctx.matchId}`);
  revalidatePath(`/l/${ctx.leagueSlug}`);
  refresh();
  return { ok: `${statDef.name} recorded.` };
}

export async function deleteStatEvent(
  leagueSlug: string,
  matchId: string,
  _prev: EntryState | undefined,
  formData: FormData,
): Promise<EntryState> {
  const ctx = await requireMatchAccess(leagueSlug, matchId, "correct");

  const id = String(formData.get("statEventId") ?? "");
  const event = await prisma.statEvent.findFirst({
    where: {
      id,
      leg: { match: { id: ctx.matchId } },
    },
    include: { statDef: { select: { name: true } } },
  });
  if (!event) return { error: "Entry not found." };

  await prisma.statEvent.delete({ where: { id: event.id } });

  await logChange({
    leagueId: ctx.leagueId,
    userId: ctx.userId,
    entity: "StatEvent",
    entityId: event.id,
    field: "deleted",
    oldValue: `${event.statDef.name} = ${event.value}`,
    newValue: null,
  });

  revalidatePath(`/l/${ctx.leagueSlug}/enter/${ctx.matchId}`);
  revalidatePath(`/l/${ctx.leagueSlug}`);
  refresh();
  return { ok: "Entry removed." };
}

/**
 * Corrects the value on an already-recorded stat event. Only league admins
 * may do this; scorers must delete and re-add instead.
 */
export async function updateStatEvent(
  leagueSlug: string,
  matchId: string,
  _prev: EntryState | undefined,
  formData: FormData,
): Promise<EntryState> {
  const ctx = await requireMatchAccess(leagueSlug, matchId, "correct");

  const id = String(formData.get("statEventId") ?? "");
  const parsed = z
    .object({ value: z.coerce.number().int().min(0).max(1000) })
    .safeParse({ value: formData.get("value") });
  if (!parsed.success) return { error: "Enter a valid value." };

  const event = await prisma.statEvent.findFirst({
    where: {
      id,
      leg: { match: { id: ctx.matchId } },
    },
    include: { statDef: { select: { name: true } } },
  });
  if (!event) return { error: "Entry not found." };

  if (event.value === parsed.data.value) {
    return { ok: "No change." };
  }

  await prisma.statEvent.update({
    where: { id: event.id },
    data: { value: parsed.data.value },
  });

  await logChange({
    leagueId: ctx.leagueId,
    userId: ctx.userId,
    entity: "StatEvent",
    entityId: event.id,
    field: "value",
    oldValue: event.value,
    newValue: parsed.data.value,
  });

  revalidatePath(`/l/${ctx.leagueSlug}/enter/${ctx.matchId}`);
  revalidatePath(`/l/${ctx.leagueSlug}`);
  refresh();
  return { ok: `${event.statDef.name} updated to ${parsed.data.value}.` };
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

const PointsSchema = z.object({
  playerId: z.string().min(1),
  points: z.coerce.number().int().min(-999).max(999),
});

export async function setPoints(
  leagueSlug: string,
  matchId: string,
  _prev: EntryState | undefined,
  formData: FormData,
): Promise<EntryState> {
  const ctx = await requireMatchAccess(leagueSlug, matchId, "enter");

  const parsed = PointsSchema.safeParse({
    playerId: formData.get("playerId"),
    points: formData.get("points"),
  });
  if (!parsed.success) return { error: "Enter a points value." };

  const participant = await prisma.matchParticipant.findFirst({
    where: { matchId: ctx.matchId, playerId: parsed.data.playerId },
  });
  if (!participant) return { error: "That player is not in this match." };

  const existing = await prisma.pointsEntry.findUnique({
    where: {
      matchId_playerId: { matchId: ctx.matchId, playerId: parsed.data.playerId },
    },
  });

  await prisma.pointsEntry.upsert({
    where: {
      matchId_playerId: { matchId: ctx.matchId, playerId: parsed.data.playerId },
    },
    update: { points: parsed.data.points },
    create: {
      leagueId: ctx.leagueId,
      matchId: ctx.matchId,
      playerId: parsed.data.playerId,
      points: parsed.data.points,
    },
  });

  // Only a change to an existing value counts as a correction.
  if (existing && existing.points !== parsed.data.points) {
    await logChange({
      leagueId: ctx.leagueId,
      userId: ctx.userId,
      entity: "PointsEntry",
      entityId: existing.id,
      field: "points",
      oldValue: existing.points,
      newValue: parsed.data.points,
    });
  }

  revalidatePath(`/l/${ctx.leagueSlug}/enter/${ctx.matchId}`);
  revalidatePath(`/l/${ctx.leagueSlug}`);
  refresh();
  return { ok: "Points saved." };
}
