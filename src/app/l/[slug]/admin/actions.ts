"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAdminLeague } from "@/lib/permissions";
import { logChange } from "@/lib/audit";
import { GameMode, StatEntryType, StatMode, CheckoutRule } from "@/generated/prisma/enums";

/**
 * Admin actions for league configuration.
 *
 * Every action resolves the caller's permission from the session and the
 * league membership - never from the submitted form - so a crafted request
 * cannot escalate privileges.
 */

export type ActionState = { error?: string; ok?: string };

async function requireLeagueAdmin(leagueSlug: string) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true, slug: true },
  });
  if (!league) throw new Error("League not found");

  const allowed = await canAdminLeague(league.id, user);
  if (!allowed) throw new Error("Not permitted");

  return { league, user };
}

// ---------------------------------------------------------------------------
// League settings
// ---------------------------------------------------------------------------

const LeagueSettingsSchema = z.object({
  name: z.string().min(1).max(120),
  teamRankingMode: z.enum(["POINTS", "WINS"]),
});

export async function updateLeagueSettings(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);

  const parsed = LeagueSettingsSchema.safeParse({
    name: formData.get("name"),
    teamRankingMode: formData.get("teamRankingMode"),
  });
  if (!parsed.success) return { error: "Check the league name and ranking mode." };

  await prisma.league.update({
    where: { id: league.id },
    data: parsed.data,
  });

  revalidatePath(`/l/${league.slug}`);
  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: "League updated." };
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function createGroup(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a group name." };

  const existing = await prisma.group.findFirst({
    where: { leagueId: league.id, name },
  });
  if (existing) return { error: "A group with that name already exists." };

  await prisma.group.create({ data: { leagueId: league.id, name } });
  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: "Group created." };
}

export async function renameGroup(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const groupId = String(formData.get("groupId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a group name." };

  const group = await prisma.group.findFirst({
    where: { id: groupId, leagueId: league.id },
  });
  if (!group) return { error: "Group not found." };

  await prisma.group.update({ where: { id: group.id }, data: { name } });
  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: "Group renamed." };
}

export async function deleteGroup(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const groupId = String(formData.get("groupId") ?? "");

  const group = await prisma.group.findFirst({
    where: { id: groupId, leagueId: league.id },
  });
  if (!group) return { error: "Group not found." };

  await prisma.group.delete({ where: { id: group.id } });
  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: "Group deleted." };
}

// ---------------------------------------------------------------------------
// Teams and players
// ---------------------------------------------------------------------------

export async function createTeam(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const groupId = String(formData.get("groupId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a team name." };

  const group = await prisma.group.findFirst({
    where: { id: groupId, leagueId: league.id },
  });
  if (!group) return { error: "Group not found." };

  const existing = await prisma.team.findFirst({
    where: { groupId: group.id, name },
  });
  if (existing) return { error: "That team already exists in this group." };

  await prisma.team.create({ data: { groupId: group.id, name } });
  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: "Team created." };
}

export async function deleteTeam(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const teamId = String(formData.get("teamId") ?? "");

  const team = await prisma.team.findFirst({
    where: { id: teamId, group: { leagueId: league.id } },
  });
  if (!team) return { error: "Team not found." };

  await prisma.team.delete({ where: { id: team.id } });
  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: "Team deleted." };
}

export async function createPlayer(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const name = String(formData.get("name") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "");

  if (!name) return { error: "Enter a player name." };

  const existing = await prisma.player.findFirst({
    where: { leagueId: league.id, name },
  });

  let player = existing;
  if (!player) {
    player = await prisma.player.create({
      data: { leagueId: league.id, name },
    });
  }

  if (teamId) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, group: { leagueId: league.id } },
    });
    if (team) {
      const onRoster = await prisma.teamPlayer.findFirst({
        where: { teamId: team.id, playerId: player.id },
      });
      if (!onRoster) {
        await prisma.teamPlayer.create({
          data: { teamId: team.id, playerId: player.id },
        });
      }
    }
  }

  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: `${player.name} added.` };
}

export async function removePlayerFromTeam(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const teamPlayerId = String(formData.get("teamPlayerId") ?? "");

  const entry = await prisma.teamPlayer.findFirst({
    where: { id: teamPlayerId, team: { group: { leagueId: league.id } } },
  });
  if (!entry) return { error: "Roster entry not found." };

  await prisma.teamPlayer.delete({ where: { id: entry.id } });
  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: "Player removed from roster." };
}

// ---------------------------------------------------------------------------
// Stat definitions
// ---------------------------------------------------------------------------

const StatDefSchema = z.object({
  name: z.string().min(1).max(60),
  mode: z.enum(["ANY", "ZERO1", "CRICKET"]),
  entryType: z.enum(["VALUE", "COUNT"]),
});

export async function createStatDef(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);

  const parsed = StatDefSchema.safeParse({
    name: formData.get("name"),
    mode: formData.get("mode"),
    entryType: formData.get("entryType"),
  });
  if (!parsed.success) return { error: "Enter a name, mode and entry type." };

  const name = parsed.data.name.trim();
  const existing = await prisma.statDef.findFirst({
    where: { leagueId: league.id, name },
  });
  if (existing) return { error: "A stat with that name already exists." };

  await prisma.statDef.create({
    data: {
      leagueId: league.id,
      name,
      mode: parsed.data.mode as StatMode,
      entryType: parsed.data.entryType as StatEntryType,
      sortOrder: await prisma.statDef.count({
        where: { leagueId: league.id },
      }),
    },
  });

  revalidatePath(`/l/${league.slug}/admin`);
  revalidatePath(`/l/${league.slug}`);
  return { ok: "Stat added." };
}

export async function retireStatDef(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league, user } = await requireLeagueAdmin(leagueSlug);
  const statDefId = String(formData.get("statDefId") ?? "");

  const stat = await prisma.statDef.findFirst({
    where: { id: statDefId, leagueId: league.id },
  });
  if (!stat) return { error: "Stat not found." };

  await prisma.statDef.update({
    where: { id: stat.id },
    data: { retired: !stat.retired },
  });

  await logChange({
    leagueId: league.id,
    userId: user.id,
    entity: "StatDef",
    entityId: stat.id,
    field: "retired",
    oldValue: stat.retired,
    newValue: !stat.retired,
  });

  revalidatePath(`/l/${league.slug}/admin`);
  revalidatePath(`/l/${league.slug}`);
  return { ok: stat.retired ? "Stat restored." : "Stat retired." };
}

export async function deleteStatDef(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const statDefId = String(formData.get("statDefId") ?? "");

  const stat = await prisma.statDef.findFirst({
    where: { id: statDefId, leagueId: league.id },
  });
  if (!stat) return { error: "Stat not found." };

  await prisma.statDef.delete({ where: { id: stat.id } });
  revalidatePath(`/l/${league.slug}/admin`);
  revalidatePath(`/l/${league.slug}`);
  return { ok: "Stat deleted." };
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export async function createSeason(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a season name." };

  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));

  await prisma.season.create({
    data: { leagueId: league.id, name, startDate, endDate },
  });

  revalidatePath(`/l/${league.slug}/admin`);
  revalidatePath(`/l/${league.slug}`);
  return { ok: "Season created." };
}

export async function toggleSeasonArchived(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league, user } = await requireLeagueAdmin(leagueSlug);
  const seasonId = String(formData.get("seasonId") ?? "");

  const season = await prisma.season.findFirst({
    where: { id: seasonId, leagueId: league.id },
  });
  if (!season) return { error: "Season not found." };

  await prisma.season.update({
    where: { id: season.id },
    data: { archived: !season.archived },
  });

  await logChange({
    leagueId: league.id,
    userId: user.id,
    entity: "Season",
    entityId: season.id,
    field: "archived",
    oldValue: season.archived,
    newValue: !season.archived,
  });

  revalidatePath(`/l/${league.slug}/admin`);
  revalidatePath(`/l/${league.slug}`);
  return { ok: season.archived ? "Season restored." : "Season archived." };
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Template and match specs
// ---------------------------------------------------------------------------

const MatchSpecSchema = z.object({
  name: z.string().min(1).max(80),
  mode: z.enum(["ZERO1", "CRICKET"]),
  playersPerSide: z.coerce.number().int().min(1).max(8),
  rotation: z.coerce.boolean(),
  legCount: z.coerce.number().int().min(1).max(21),
  checkoutRule: z.enum(["DOUBLE_OUT", "DOUBLE_IN", "NONE"]),
  cricketTarget: z.coerce.number().int().min(1).max(60).optional(),
  startScore: z.coerce.number().int().min(1).max(1000).optional(),
});

export async function createMatchSpec(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const groupId = String(formData.get("groupId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");

  const parsed = MatchSpecSchema.safeParse({
    name: formData.get("name"),
    mode: formData.get("mode"),
    playersPerSide: formData.get("playersPerSide"),
    rotation: formData.get("rotation") === "on",
    legCount: formData.get("legCount"),    checkoutRule: formData.get("checkoutRule"),
    cricketTarget: formData.get("cricketTarget") || undefined,
    startScore: formData.get("startScore") || undefined,
  });
  if (!parsed.success) {
    return { error: "Check the match format fields." };
  }

  // The group owns the template; the template id in the form is only a hint.
  const template = await prisma.template.findFirst({
    where: {
      group: groupId
        ? { id: groupId, leagueId: league.id }
        : { leagueId: league.id },
      ...(templateId ? { id: templateId } : {}),
    },
  });
  if (!template) return { error: "Template not found." };

  await prisma.matchSpec.create({
    data: {
      templateId: template.id,
      name: parsed.data.name,
      sortOrder: await prisma.matchSpec.count({
        where: { templateId: template.id },
      }),
      mode: parsed.data.mode as GameMode,
      playersPerSide: parsed.data.playersPerSide,
      rotation: parsed.data.rotation,
      legCount: parsed.data.legCount,
      checkoutRule: parsed.data.checkoutRule as CheckoutRule,
      cricketTarget: parsed.data.cricketTarget ?? null,
      startScore: parsed.data.startScore ?? null,
    },
  });

  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: "Match format added." };
}

export async function deleteMatchSpec(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const matchSpecId = String(formData.get("matchSpecId") ?? "");

  const spec = await prisma.matchSpec.findFirst({
    where: { id: matchSpecId, template: { group: { leagueId: league.id } } },
  });
  if (!spec) return { error: "Match format not found." };

  await prisma.matchSpec.delete({ where: { id: spec.id } });
  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: "Match format removed." };
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function addMember(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league } = await requireLeagueAdmin(leagueSlug);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const isLeagueAdmin = formData.get("isLeagueAdmin") === "on";
  const isScorer = formData.get("isScorer") === "on";

  if (!email) return { error: "Enter an email address." };
  if (!isLeagueAdmin && !isScorer) {
    return { error: "Grant at least one role." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return {
      error:
        "No account exists for that email. The person needs to sign up first.",
    };
  }

  await prisma.leagueMember.upsert({
    where: { leagueId_userId: { leagueId: league.id, userId: user.id } },
    update: { isLeagueAdmin, isScorer },
    create: { leagueId: league.id, userId: user.id, isLeagueAdmin, isScorer },
  });

  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: `${user.name} updated.` };
}

export async function removeMember(
  leagueSlug: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { league, user } = await requireLeagueAdmin(leagueSlug);
  const memberId = String(formData.get("memberId") ?? "");

  const member = await prisma.leagueMember.findFirst({
    where: { id: memberId, leagueId: league.id },
  });
  if (!member) return { error: "Member not found." };

  if (member.userId === user.id) {
    return { error: "You cannot remove yourself from the league." };
  }

  await prisma.leagueMember.delete({ where: { id: member.id } });
  revalidatePath(`/l/${league.slug}/admin`);
  return { ok: "Member removed." };
}
