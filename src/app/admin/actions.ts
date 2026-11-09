"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

/**
 * Platform admin actions.
 *
 * The site owner seeds leagues, creates the first league admin for a league,
 * and can delete a league on request. League admins cannot delete leagues.
 */

export type ActionState = { error?: string; ok?: string };

async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isPlatformAdmin) throw new Error("Not permitted");
  return user;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const LeagueSchema = z.object({
  name: z.string().min(1).max(120),
  adminEmail: z.string().email().optional().or(z.literal("")),
});

export async function createLeague(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requirePlatformAdmin();

  const parsed = LeagueSchema.safeParse({
    name: formData.get("name"),
    adminEmail: formData.get("adminEmail") ?? "",
  });
  if (!parsed.success) return { error: "Enter a league name." };

  const name = parsed.data.name.trim();
  let slug = slugify(name) || "league";

  // Ensure the slug is unique.
  const existing = await prisma.league.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const league = await prisma.league.create({
    data: { name, slug },
  });

  // Give the league a default season so it is usable straight away.
  const year = new Date().getFullYear();
  await prisma.season.create({
    data: { leagueId: league.id, name: String(year) },
  });

  // Optionally create the first league admin and their account.
  const adminEmail = parsed.data.adminEmail?.trim().toLowerCase();
  if (adminEmail) {
    const password = await bcrypt.hash("dartleague", 10);
    const user = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        name: parsed.data.name + " Admin",
        passwordHash: password,
      },
    });
    await prisma.leagueMember.create({
      data: {
        leagueId: league.id,
        userId: user.id,
        isLeagueAdmin: true,
        isScorer: true,
      },
    });
  }

  revalidatePath("/admin");
  return { ok: `League "${name}" created.` };
}

export async function deleteLeague(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requirePlatformAdmin();

  const leagueId = String(formData.get("leagueId") ?? "");
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true },
  });
  if (!league) return { error: "League not found." };

  await prisma.league.delete({ where: { id: league.id } });

  revalidatePath("/admin");
  return { ok: `League "${league.name}" deleted.` };
}

export async function createUser(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requirePlatformAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !name) return { error: "Enter a name and email." };
  if (password.length < 8) {
    return { error: "Passwords must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "That email already has an account." };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name, passwordHash },
  });

  revalidatePath("/admin");
  return { ok: `Account created for ${name}.` };
}
