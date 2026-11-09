import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Audit logging for corrections.
 *
 * Any change to already-recorded data is written to the ChangeLog so a league
 * admin can see who changed what, and when. The record itself keeps only its
 * current values; the history lives in the log.
 */

export type ChangeEntity =
  | "Leg"
  | "StatEvent"
  | "PointsEntry"
  | "MatchParticipant"
  | "StatDef"
  | "Season"
  | "Group"
  | "Team";

/**
 * Records a change. Never throws: a failure to log must not roll back or
 * block the correction itself.
 */
export async function logChange(params: {
  leagueId: string;
  userId: string;
  entity: ChangeEntity;
  entityId: string;
  field: string;
  oldValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
}): Promise<void> {
  try {
    await prisma.changeLog.create({
      data: {
        leagueId: params.leagueId,
        userId: params.userId,
        entity: params.entity,
        entityId: params.entityId,
        field: params.field,
        oldValue: toText(params.oldValue),
        newValue: toText(params.newValue),
      },
    });
  } catch {
    // Logging is best-effort; a correction should still go through.
  }
}

/** Logs several field changes for one entity in a single batch. */
export async function logChanges(params: {
  leagueId: string;
  userId: string;
  entity: ChangeEntity;
  entityId: string;
  changes: {
    field: string;
    oldValue?: string | number | boolean | null;
    newValue?: string | number | boolean | null;
  }[];
}): Promise<void> {
  if (params.changes.length === 0) return;

  try {
    await prisma.changeLog.createMany({
      data: params.changes.map((c) => ({
        leagueId: params.leagueId,
        userId: params.userId,
        entity: params.entity,
        entityId: params.entityId,
        field: c.field,
        oldValue: toText(c.oldValue),
        newValue: toText(c.newValue),
      })),
    });
  } catch {
    // Best-effort.
  }
}

function toText(value: string | number | boolean | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}
