"use client";

import { useActionState } from "react";
import {
  Card,
  CardHeader,
  EmptyState,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  addMember,
  createGroup,
  createMatchSpec,
  createPlayer,
  createSeason,
  createStatDef,
  createTeam,
  deleteGroup,
  deleteMatchSpec,
  deleteStatDef,
  deleteTeam,
  removeMember,
  removePlayerFromTeam,
  retireStatDef,
  toggleSeasonArchived,
  updateLeagueSettings,
  type ActionState,
} from "@/app/l/[slug]/admin/actions";

type GroupData = {
  id: string;
  name: string;
  teams: { id: string; name: string; roster: { id: string; name: string }[] }[];
};
type StatDefData = {
  id: string;
  name: string;
  mode: string;
  entryType: string;
  retired: boolean;
};
type SeasonData = {
  id: string;
  name: string;
  archived: boolean;
  startDate: string | null;
  endDate: string | null;
};
type MemberData = {
  id: string;
  name: string;
  email: string;
  isLeagueAdmin: boolean;
  isScorer: boolean;
};
type TemplateData = {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  matchSpecs: {
    id: string;
    name: string;
    mode: string;
    playersPerSide: number;
    rotation: boolean;
    legCount: number;
    checkoutRule: string;
    cricketTarget: number | null;
    startScore: number | null;
  }[];
};

export function AdminPanel({
  leagueSlug,
  leagueName,
  teamRankingMode,
  groups,
  statDefs,
  seasons,
  members,
  templates,
}: {
  leagueSlug: string;
  leagueName: string;
  teamRankingMode: string;
  groups: GroupData[];
  statDefs: StatDefData[];
  seasons: SeasonData[];
  members: MemberData[];
  templates: TemplateData[];
}) {
  return (
    <div className="space-y-6">
      <LeagueSettings
        leagueSlug={leagueSlug}
        leagueName={leagueName}
        teamRankingMode={teamRankingMode}
      />
      <GroupsSection leagueSlug={leagueSlug} groups={groups} />
      <StatsSection leagueSlug={leagueSlug} statDefs={statDefs} />
      <SeasonsSection leagueSlug={leagueSlug} seasons={seasons} />
      <TemplatesSection leagueSlug={leagueSlug} templates={templates} />
      <MembersSection leagueSlug={leagueSlug} members={members} />
    </div>
  );
}

/** Small helper that renders a server action's state next to a form. */
function ActionFeedback({ state }: { state: ActionState | undefined }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p
      className={`mt-2 text-sm ${
        state.error ? "text-red-300" : "text-green"
      }`}
    >
      {state.error ?? state.ok}
    </p>
  );
}

function LeagueSettings({
  leagueSlug,
  leagueName,
  teamRankingMode,
}: {
  leagueSlug: string;
  leagueName: string;
  teamRankingMode: string;
}) {
  const [state, action] = useActionState<ActionState | undefined, FormData>(
    (prev, formData) => updateLeagueSettings(leagueSlug, prev, formData),
    undefined,
  );

  return (
    <Card>
      <CardHeader
        title="League settings"
        description="How teams are ranked on the standings table."
      />
      <form action={action} className="space-y-3 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="league-name" className="block text-sm font-medium">
              League name
            </label>
            <input
              id="league-name"
              name="name"
              defaultValue={leagueName}
              required
              className="w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ranking" className="block text-sm font-medium">
              Rank teams by
            </label>
            <select
              id="ranking"
              name="teamRankingMode"
              defaultValue={teamRankingMode}
              className="w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
            >
              <option value="POINTS">Points</option>
              <option value="WINS">Wins / losses</option>
            </select>
          </div>
        </div>
        <SubmitButton>Save settings</SubmitButton>
        <ActionFeedback state={state} />
      </form>
    </Card>
  );
}

function GroupsSection({
  leagueSlug,
  groups,
}: {
  leagueSlug: string;
  groups: GroupData[];
}) {
  const [groupState, groupAction] = useActionState<ActionState | undefined, FormData>(
    (prev, formData) => createGroup(leagueSlug, prev, formData),
    undefined,
  );
  const [teamState, teamAction] = useActionState<ActionState | undefined, FormData>(
    (prev, formData) => createTeam(leagueSlug, prev, formData),
    undefined,
  );
  const [playerState, playerAction] = useActionState<
    ActionState | undefined,
    FormData
  >((prev, formData) => createPlayer(leagueSlug, prev, formData), undefined);

  const allTeams = groups.flatMap((g) =>
    g.teams.map((t) => ({ ...t, groupId: g.id })),
  );

  return (
    <Card>
      <CardHeader
        title="Groups, teams and players"
        description="Groups own their teams and their match template."
      />
      <div className="space-y-5 px-5 py-4">
        {groups.length === 0 ? (
          <EmptyState title="No groups yet" description="Create your first group." />
        ) : (
          groups.map((group) => (
            <div key={group.id} className="rounded-lg border border-border-strong">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <p className="font-medium">{group.name}</p>
                <DeleteButton
                  action={deleteGroup}
                  leagueSlug={leagueSlug}
                  fields={{ groupId: group.id }}
                  label="Delete group"
                />
              </div>
              <div className="divide-y divide-border">
                {group.teams.map((team) => (
                  <div key={team.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{team.name}</p>
                      <DeleteButton
                        action={deleteTeam}
                        leagueSlug={leagueSlug}
                        fields={{ teamId: team.id }}
                        label="Delete team"
                      />
                    </div>
                    {team.roster.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {team.roster.map((p) => (
                          <li
                            key={p.id}
                            className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-raised px-2.5 py-0.5 text-xs"
                          >
                            {p.name}
                            <DeleteButton
                              action={removePlayerFromTeam}
                              leagueSlug={leagueSlug}
                              fields={{ teamPlayerId: p.id }}
                              label="Remove"
                              compact
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted">No roster yet.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
          <form action={groupAction} className="space-y-2">
            <p className="text-sm font-medium">Add group</p>
            <input
              name="name"
              placeholder="Division 2"
              required
              className="w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
            />
            <SubmitButton>Add group</SubmitButton>
            <ActionFeedback state={groupState} />
          </form>

          <form action={teamAction} className="space-y-2">
            <p className="text-sm font-medium">Add team</p>
            <select
              name="groupId"
              required
              className="w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <input
              name="name"
              placeholder="Team Charlie"
              required
              className="w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
            />
            <SubmitButton>Add team</SubmitButton>
            <ActionFeedback state={teamState} />
          </form>

          <form action={playerAction} className="space-y-2">
            <p className="text-sm font-medium">Add player</p>
            <select
              name="teamId"
              className="w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
            >
              <option value="">No team</option>
              {allTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              name="name"
              placeholder="Jordan Reyes"
              required
              className="w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
            />
            <SubmitButton>Add player</SubmitButton>
            <ActionFeedback state={playerState} />
          </form>
        </div>
      </div>
    </Card>
  );
}

function StatsSection({
  leagueSlug,
  statDefs,
}: {
  leagueSlug: string;
  statDefs: StatDefData[];
}) {
  const [state, action] = useActionState<ActionState | undefined, FormData>(
    (prev, formData) => createStatDef(leagueSlug, prev, formData),
    undefined,
  );

  return (
    <Card>
      <CardHeader
        title="Tracked stats"
        description="The league decides what it counts. VALUE records an actual number (high out); COUNT records how many times it happened."
      />
      <div className="space-y-4 px-5 py-4">
        {statDefs.length === 0 ? (
          <EmptyState
            title="No stats configured"
            description="Add the achievements this league tracks, e.g. 100+, High Out, 5 Marks."
          />
        ) : (
          <Table
            head={
              <>
                <Th>Name</Th>
                <Th>Mode</Th>
                <Th>Entry</Th>
                <Th>Status</Th>
                <Th />
              </>
            }
          >
            {statDefs.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.name}</Td>
                <Td className="text-muted">
                  {s.mode === "ZERO1"
                    ? "01"
                    : s.mode === "CRICKET"
                      ? "Cricket"
                      : "Any"}
                </Td>
                <Td className="text-muted">
                  {s.entryType === "VALUE" ? "Value" : "Count"}
                </Td>
                <Td className="text-muted">
                  {s.retired ? "Retired" : "Active"}
                </Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <InlineButton
                      action={retireStatDef}
                      leagueSlug={leagueSlug}
                      fields={{ statDefId: s.id }}
                      label={s.retired ? "Restore" : "Retire"}
                    />
                    <DeleteButton
                      action={deleteStatDef}
                      leagueSlug={leagueSlug}
                      fields={{ statDefId: s.id }}
                      label="Delete stat"
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}

        <form action={action} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <input
            name="name"
            placeholder="140+"
            required
            className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />
          <select
            name="mode"
            className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          >
            <option value="ANY">Any mode</option>
            <option value="ZERO1">01</option>
            <option value="CRICKET">Cricket</option>
          </select>
          <select
            name="entryType"
            className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          >
            <option value="COUNT">Count</option>
            <option value="VALUE">Value</option>
          </select>
          <SubmitButton>Add stat</SubmitButton>
          <div className="sm:col-span-4">
            <ActionFeedback state={state} />
          </div>
        </form>
      </div>
    </Card>
  );
}

function SeasonsSection({
  leagueSlug,
  seasons,
}: {
  leagueSlug: string;
  seasons: SeasonData[];
}) {
  const [state, action] = useActionState<ActionState | undefined, FormData>(
    (prev, formData) => createSeason(leagueSlug, prev, formData),
    undefined,
  );
  const [archiveState, archiveAction] = useActionState<
    ActionState | undefined,
    FormData
  >((prev, formData) => toggleSeasonArchived(leagueSlug, prev, formData), undefined);

  return (
    <Card>
      <CardHeader
        title="Seasons"
        description="Seasons scope standings and high score boards. Archived seasons are hidden by default."
      />
      <div className="space-y-4 px-5 py-4">
        {seasons.length === 0 ? (
          <EmptyState title="No seasons yet" />
        ) : (
          <Table
            head={
              <>
                <Th>Name</Th>
                <Th>Dates</Th>
                <Th>Status</Th>
                <Th />
              </>
            }
          >
            {seasons.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.name}</Td>
                <Td className="text-muted">
                  {s.startDate ?? "—"} to {s.endDate ?? "—"}
                </Td>
                <Td className="text-muted">
                  {s.archived ? "Archived" : "Active"}
                </Td>
                <Td>
                  <form action={archiveAction} className="flex justify-end">
                    <input type="hidden" name="seasonId" value={s.id} />
                    <SubmitButton>
                      {s.archived ? "Restore" : "Archive"}
                    </SubmitButton>
                  </form>
                </Td>
              </tr>
            ))}
          </Table>
        )}

        <form
          action={action}
          className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4"
        >
          <input
            name="name"
            placeholder="Fall 2026"
            required
            className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />
          <input
            name="startDate"
            type="date"
            className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />
          <input
            name="endDate"
            type="date"
            className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />
          <SubmitButton>Add season</SubmitButton>
          <div className="sm:col-span-4">
            <ActionFeedback state={state} />
            <ActionFeedback state={archiveState} />
          </div>
        </form>
      </div>
    </Card>
  );
}

function TemplatesSection({
  leagueSlug,
  templates,
}: {
  leagueSlug: string;
  templates: TemplateData[];
}) {
  const [state, action] = useActionState<ActionState | undefined, FormData>(
    (prev, formData) => createMatchSpec(leagueSlug, prev, formData),
    undefined,
  );

  return (
    <Card>
      <CardHeader
        title="Match formats"
        description="Each group's template is the list of matches played on a league night."
      />
      <div className="space-y-5 px-5 py-4">
        {templates.length === 0 ? (
          <EmptyState title="No templates yet" />
        ) : (
          templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-border-strong">
              <div className="border-b border-border px-4 py-2.5">
                <p className="font-medium">{t.groupName}</p>
                <p className="text-xs text-muted">{t.name}</p>
              </div>
              <div className="divide-y divide-border">
                {t.matchSpecs.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">
                    No match formats yet.
                  </p>
                ) : (
                  t.matchSpecs.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted">
                          {s.mode === "CRICKET" ? "Cricket" : "01"} ·{" "}
                          {s.playersPerSide} per side
                          {s.rotation ? " (rotation)" : ""} · {s.legCount} leg
                          {s.legCount === 1 ? "" : "s"}
                          {s.startScore ? ` · ${s.startScore} start` : ""}
                          {s.cricketTarget ? ` · ${s.cricketTarget} target` : ""}
                        </p>
                      </div>
                      <DeleteButton
                        action={deleteMatchSpec}
                        leagueSlug={leagueSlug}
                        fields={{ matchSpecId: s.id }}
                        label="Remove format"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}

        {templates.length > 0 ? (
          <form
            action={action}
            className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4"
          >
            <select
              name="groupId"
              required
              className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.groupId}>
                  {t.groupName}
                </option>
              ))}
            </select>
            <input
              name="name"
              placeholder="Singles 501"
              required
              className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
            />
            <select
              name="mode"
              className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
            >
              <option value="ZERO1">01</option>
              <option value="CRICKET">Cricket</option>
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input
                name="playersPerSide"
                type="number"
                min={1}
                max={8}
                defaultValue={1}
                title="Players per side"
                className="rounded border border-border-strong bg-background px-2 py-2 text-sm text-foreground outline-none transition focus:border-accent"
              />
              <input
                name="legCount"
                type="number"
                min={1}
                max={21}
                defaultValue={3}
                title="Legs"
                className="rounded border border-border-strong bg-background px-2 py-2 text-sm text-foreground outline-none transition focus:border-accent"
              />
              <input
                name="startScore"
                type="number"
                min={1}
                placeholder="501"
                title="Start score"
                className="rounded border border-border-strong bg-background px-2 py-2 text-sm text-foreground outline-none transition focus:border-accent"
              />
            </div>
            <div className="grid gap-2 sm:col-span-4 sm:grid-cols-4">
              <select
                name="checkoutRule"
                className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
              >
                <option value="DOUBLE_OUT">Double out</option>
                <option value="DOUBLE_IN">Double in</option>
                <option value="NONE">No rule</option>
              </select>
              <input
                name="cricketTarget"
                type="number"
                min={1}
                max={60}
                placeholder="Cricket target"
                className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="rotation" /> Rotation
              </label>
              <SubmitButton>Add format</SubmitButton>
            </div>
            <div className="sm:col-span-4">
              <ActionFeedback state={state} />
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted">
            Create a group first — each group owns one template.
          </p>
        )}
      </div>
    </Card>
  );
}

function MembersSection({
  leagueSlug,
  members,
}: {
  leagueSlug: string;
  members: MemberData[];
}) {
  const [state, action] = useActionState<ActionState | undefined, FormData>(
    (prev, formData) => addMember(leagueSlug, prev, formData),
    undefined,
  );

  return (
    <Card>
      <CardHeader
        title="Members"
        description="League admins manage the scorer roster and can appoint other league admins."
      />
      <div className="space-y-4 px-5 py-4">
        <Table
          head={
            <>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Roles</Th>
              <Th />
            </>
          }
        >
          {members.map((m) => (
            <tr key={m.id}>
              <Td className="font-medium">{m.name}</Td>
              <Td className="text-muted">{m.email}</Td>
              <Td className="text-muted">
                {[
                  m.isLeagueAdmin ? "League admin" : null,
                  m.isScorer ? "Scorer" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </Td>
              <Td>
                <div className="flex justify-end">
                  <DeleteButton
                    action={removeMember}
                    leagueSlug={leagueSlug}
                    fields={{ memberId: m.id }}
                    label="Remove member"
                  />
                </div>
              </Td>
            </tr>
          ))}
        </Table>

        <form
          action={action}
          className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4"
        >
          <input
            name="email"
            type="email"
            placeholder="scorer@example.com"
            required
            className="rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent sm:col-span-2"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isLeagueAdmin" /> League admin
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isScorer" /> Scorer
          </label>
          <div className="sm:col-span-4">
            <SubmitButton>Add member</SubmitButton>
            <ActionFeedback state={state} />
          </div>
        </form>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded bg-accent px-3 py-2 text-sm font-semibold text-background transition hover:brightness-110"
    >
      {children}
    </button>
  );
}

/**
 * Wraps a server action in a form so it can be triggered from a table row.
 *
 * The action takes (leagueSlug, prev, formData); the form only supplies
 * FormData, so we bind the league slug and a `prev` placeholder up front.
 */
function InlineButton({
  action,
  leagueSlug,
  fields,
  label,
}: {
  action: (
    leagueSlug: string,
    prev: ActionState | undefined,
    formData: FormData,
  ) => Promise<ActionState>;
  leagueSlug: string;
  fields: Record<string, string>;
  label: string;
}) {
  return (
    <form action={bindAction(action, leagueSlug)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className="rounded border border-border-strong bg-surface px-2 py-1 text-xs text-muted transition hover:border-accent hover:text-accent"
      >
        {label}
      </button>
    </form>
  );
}

function DeleteButton({
  action,
  leagueSlug,
  fields,
  label,
  compact = false,
}: {
  action: (
    leagueSlug: string,
    prev: ActionState | undefined,
    formData: FormData,
  ) => Promise<ActionState>;
  leagueSlug: string;
  fields: Record<string, string>;
  label: string;
  compact?: boolean;
}) {
  return (
    <form action={bindAction(action, leagueSlug)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        aria-label={label}
        className={
          compact
            ? "rounded-full px-1.5 text-muted transition hover:bg-red/15 hover:text-red"
            : "rounded border border-border-strong bg-surface px-2 py-1 text-xs text-muted transition hover:border-red hover:text-red"
        }
      >
        {compact ? "×" : "Delete"}
      </button>
    </form>
  );
}

/**
 * Binds a server action so it can be used as a plain `<form action>`.
 * The `prev` argument is unused by these actions, so it is left undefined.
 */
function bindAction(
  action: (
    leagueSlug: string,
    prev: ActionState | undefined,
    formData: FormData,
  ) => Promise<ActionState>,
  leagueSlug: string,
) {
  return async (formData: FormData) => {
    await action(leagueSlug, undefined, formData);
  };
}
