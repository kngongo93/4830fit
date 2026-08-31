# 4830 Fit

Progressive-overload lifting tracker. Log your sets, see what you did last week, add weight.

Private by default: your training log is yours. Other users see it only if you
explicitly grant them access, and you can revoke that at any time.

## Stack

- Next.js 15 (App Router) + TypeScript — PWA frontend and API in one deployable
- Postgres + Drizzle ORM
- Cookie sessions, bcrypt password hashes, invite-only signup
- DigitalOcean App Platform + Managed Postgres

## Local setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in `DATABASE_URL`.

```bash
createdb fit4830
npm run db:push      # create tables
npm run db:seed      # load the exercise library
npm run admin:create # create the first admin account
npm run dev
```

Verify the access model and training math at any time:

```bash
npm run smoke
```

### Postgres on this dev machine

Postgres runs from an extracted binary directory rather than a registered
Windows service, so it does not start on boot. Start it before `npm run dev`:

```
C:\Users\kevin\pgsql\bin\pg_ctl.exe -D C:\Users\kevin\pgdata -l C:\Users\kevin\pgdata\server.log start
```

Swap `start` for `stop` to shut it down. It listens on localhost only.

## Layout

| Path | What lives there |
|---|---|
| `src/db/schema.ts` | Every table. Start here. |
| `src/lib/access.ts` | The privacy model. Every cross-user read goes through it. |
| `src/lib/auth.ts` | Sessions, password hashing, invite codes. |
| `src/lib/training.ts` | e1RM, progression suggestions, plate math. Pure functions, no DB. |
| `src/app/` | Routes. |

## Notes

Weights are always stored in pounds and converted at the edges, so switching
your unit preference never rewrites history.
