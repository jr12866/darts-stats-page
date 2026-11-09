# DartLeague

A stats and dashboard site for dart leagues. Handles multiple leagues, each
with its own match templates, groups, teams, tracked high-score stats and
season standings.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Prisma 7** with SQLite via the `better-sqlite3` driver adapter
- **Tailwind CSS 4**
- Hand-rolled session-cookie auth (bcrypt + a `Session` table)

### Theme

The site is styled as a dark Irish pub: aged mahogany surfaces, brass and
shamrock green accents, and cream text the colour of lamplight. The palette
and shared textures (wood grain, brass plaques, rank badges) live in
`src/app/globals.css` as CSS custom properties plus a few utility classes —
change the variables there to retheme the whole site.

## Getting started

```bash
npm install
npm run db:migrate      # create the SQLite database and apply migrations
npm run db:seed         # seed a demo league with sample data
npm run dev             # http://localhost:3000
```

Seeded accounts (all use the password `dartleague`):

| Account                     | Role                    |
| --------------------------- | ----------------------- |
| `owner@dartleague.test`     | Site admin (platform)   |
| `admin@dartleague.test`     | League admin            |
| `scorer@dartleague.test`    | Scorer                  |

The demo league lives at `/l/demo-league`; its admin area is at
`/l/demo-league/admin`, its activity log at `/l/demo-league/activity`, and the
site admin area at `/admin`.

**Public pages.** Every league has a public, read-only page at
`/public/<league-slug>` that anyone with the link can open — no login
required. It shows standings, high scores, results and player profiles, and
links to nothing that can be edited.

## Scripts

| Script              | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Start the dev server                        |
| `npm run build`     | Production build (runs `prisma generate`)   |
| `npm run typecheck` | Type-check without emitting                 |
| `npm run db:migrate`| Create/apply a migration                    |
| `npm run db:seed`   | Reset the demo data                         |
| `npm run db:studio` | Browse the database                         |
| `npm run smoke`     | Playwright end-to-end checks (needs `dev`)  |

## Domain model

```
League
├─ Season                named period; optional dates; archivable
├─ Group                 flat division, owns teams + one template
│  ├─ Team               has a roster of players
│  └─ Template           the list of match formats played on a night
│     └─ MatchSpec       mode, players per side, rotation, legs, checkout rule
├─ Player                name-only record; no login
├─ StatDef               league-configured tracked stat
└─ LeagueMember          user × league × role flags

Night                   an instance of a group's template on a date
└─ Match                 format copied from the spec at time of play
   ├─ MatchParticipant   who played on each side
   └─ Leg                one game; result is always side-level
      └─ StatEvent       a player's achievement in that leg

PointsEntry              manually entered points for a player in a match
ChangeLog                audit trail of corrections
```

### Key decisions

- **Roles are league-scoped.** The same person can be a league admin in one
  league and a scorer in another. Roles are independent flags, so a user can
  hold both in the same league.
- **Players are names, not accounts.** Admins maintain the player list; a
  scorer may enter any league player in a match, which is how substitutes
  work.
- **Stats are league-configured.** A `StatDef` has a name, a mode
  (`01` / `cricket` / any) and an entry type:
  - `VALUE` — the scorer enters the actual number (e.g. a high out of 140).
    Leaderboards rank by the highest value.
  - `COUNT` — the scorer enters how many times it happened (e.g. three
    100+ scores). Leaderboards rank by the sum.

  The system never interprets a stat; the league decides what each one means.
- **Points are entered by hand.** The system records and totals them but
  never computes them, so every league's own scheme works without
  configuration.
- **Everything derived is computed on the fly.** Standings, high-score boards
  and player cards are calculated from the recorded data, so correcting a
  record immediately corrects every figure.
- **A match's format is copied from the template when it is played**, so
  historical results keep their format even if the template later changes.
- **Corrections are logged.** Changing a recorded leg result, a stat value,
  the points or the line-up writes to `ChangeLog` with who, when and the old
  and new value. The league's activity log shows this.

## Permissions

| Action                              | Site admin | League admin | Scorer |
| ----------------------------------- | ---------- | ------------ | ------ |
| Create / delete leagues             | yes        | no           | no     |
| Groups, teams, templates, stats, seasons | yes   | yes          | no     |
| Appoint league admins, manage scorers | yes      | yes          | no     |
| Enter results and points            | yes        | yes          | yes    |
| Correct existing records            | yes        | yes          | no     |
| View the activity log               | yes        | yes          | no     |
| View the dashboard (members)        | yes        | yes          | yes    |
| View the public page                | anyone with the link | | |

## Layout

```
prisma/
  schema.prisma        data model
  seed.ts              demo data
src/
  app/
    login/             sign in
    leagues/           leagues you belong to
    admin/             platform admin (site owner)
    public/[slug]/     public read-only dashboard and player profiles
    l/[slug]/          member dashboard, tabs, season + group filters
      admin/           league configuration
      activity/        correction / audit log
      enter/           night list, match entry
      player/[id]/     player profile
  components/          UI
  lib/
    prisma.ts          client + adapter
    session.ts         session cookie handling
    permissions.ts     role resolution and access checks
    audit.ts           change-log helper
    stats.ts           standings, leaderboards and player cards
```

## Notes

- The SQLite file lives at `prisma/dev.db`. Back it up by copying that file.
- Moving to Postgres later means swapping the datasource provider in
  `prisma/schema.prisma`, the driver adapter in `src/lib/prisma.ts`, and
  `DATABASE_URL`.
- `getSessionUser` uses `use cache: private` because it reads the session
  cookie. Pages that read the session are wrapped in `<Suspense>` so the
  static shell still prerenders.
