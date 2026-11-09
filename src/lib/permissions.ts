import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

/**
 * Permission model
 *
 * Three tiers, all league-scoped:
 *   - Platform admin: the site owner. Seeds/leagues, deletes leagues, and can
 *     override anything.
 *   - League admin: appointed by the platform admin, can appoint other league
 *     admins (self-perpetuating within the league). Manages templates, scorers,
 *     stat definitions, seasons. Cannot delete the league.
 *   - Scorer: can enter match results and points. Cannot correct records.
 *
 * A user can hold different roles in different leagues; permissions are
 * resolved per league, never globally.
 */

export type LeagueRole = {
  isLeagueAdmin: boolean;
  isScorer: boolean;
};

export type LeaguePermission = "view" | "enter" | "correct" | "admin";

export async function getLeagueRole(
  leagueId: string,
  userId: string,
): Promise<LeagueRole | null> {
  const member = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
    select: { isLeagueAdmin: true, isScorer: true },
  });
  return member;
}

/**
 * Resolves the effective permission for a user against a league.
 *
 * Platform admins get full access everywhere. League admins get "correct"
 * (they may fix records). Scorers get "enter" only.
 */
export async function getLeaguePermission(
  leagueId: string,
  user: SessionUser | null,
): Promise<LeaguePermission | null> {
  if (!user) return null;
  if (user.isPlatformAdmin) return "admin";

  const role = await getLeagueRole(leagueId, user.id);
  if (!role) return null;
  if (role.isLeagueAdmin) return "admin";
  if (role.isScorer) return "enter";
  return null;
}

/** True when the user may write data (enter results/points) for the league. */
export async function canEnter(
  leagueId: string,
  user: SessionUser | null,
): Promise<boolean> {
  const perm = await getLeaguePermission(leagueId, user);
  return perm === "admin" || perm === "enter";
}

/** True when the user may modify or correct existing records for the league. */
export async function canCorrect(
  leagueId: string,
  user: SessionUser | null,
): Promise<boolean> {
  const perm = await getLeaguePermission(leagueId, user);
  return perm === "admin";
}

/** True when the user may change league configuration. */
export async function canAdminLeague(
  leagueId: string,
  user: SessionUser | null,
): Promise<boolean> {
  const perm = await getLeaguePermission(leagueId, user);
  return perm === "admin";
}

/**
 * Resolves a league by slug and verifies the caller has at least the given
 * permission. Returns null when the league does not exist or access is denied.
 */
export async function requireLeagueAccess(
  slug: string,
  user: SessionUser | null,
  minimum: LeaguePermission = "view",
) {
  const league = await prisma.league.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      teamRankingMode: true,
    },
  });
  if (!league) return null;

  const perm = await getLeaguePermission(league.id, user);
  if (!perm) return null;

  const rank: Record<LeaguePermission, number> = {
    view: 0,
    enter: 1,
    correct: 2,
    admin: 3,
  };

  if (rank[perm] < rank[minimum]) return null;

  return { league, permission: perm };
}

/**
 * Resolves a league by slug for the public dashboard.
 *
 * The public page shows standings, high scores and results to anyone with the
 * link. It never exposes configuration or entry controls, so no permission
 * check is needed beyond the league existing.
 */
export async function getPublicLeague(slug: string) {
  return prisma.league.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      teamRankingMode: true,
    },
  });
}
