# Reunify

AI-assisted school emergency accountability and reunification platform.

This repository currently contains the proof-of-concept Reunify app: a student
check-in flow, a teacher roll-call flow, and a staff command center. The next
implementation phases will expand it into the role-based product described in
`/Users/jaylanroy/Desktop/reunify_plan.md` while preserving the working demo
features already in this repo.

## Routes

| Path | Audience |
|------|----------|
| `/` | Demo role chooser |
| `/check-in` | Students - report safe/unsafe, room, teacher, GPS, and optional notes. No map or roster data. |
| `/teacher` | Teachers - voice roll call or roster checkboxes. |
| `/admin` | Staff - campus map, live feed, teacher reports, and unaccounted list. |

Planned Reunify routes include `/student`, `/parent`, and `/responder`.

## Run locally

```bash
npm install
cp .env.local.example .env.local
# Fill Firebase, Firebase Admin, and Gemini values as needed.
npm run dev
```

Open:

```txt
http://localhost:3000
```

Without Firebase environment variables, `/admin` runs in demo mode with
simulated check-ins.

## Environment

Use `.env.example` as the canonical template for deployment and
`.env.local.example` for local development. Do not commit `.env`, `.env.local`,
service account JSON, private keys, or Vercel project files.

## Firebase

See [docs/FIREBASE.md](docs/FIREBASE.md) for Auth, Firestore rules, service
account configuration, seeding the current room catalog, and indexes.

The current proof of concept supports `FIREBASE_SERVICE_ACCOUNT_JSON`. New
Reunify server code should prefer the split admin variables:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## Gemini

Future Reunify report parsing and broadcast generation will call Gemini only
from server-side routes. Configure:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite
```

## Deploy

```bash
npx vercel
```

Add the same environment variables in the Vercel project settings for
Development, Preview, and Production.
