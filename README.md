# Evacuation Command

School evacuation drill prototype: staff command center + student mobile check-in.

## Routes

| Path | Audience |
|------|----------|
| `/check-in` | **Students** — report safe/unsafe, room, teacher, GPS. No map, no admin data. |
| `/teacher` | **Teachers** — voice roll call or roster checkboxes |
| `/admin` | **Staff** — campus map, live feed, unaccounted list |
| `/` | Chooser (student vs staff) |

## Run locally

```bash
npm install
cp .env.local.example .env.local
# fill Firebase keys (see docs/FIREBASE.md)
npm run dev
```

Without Firebase env vars, `/admin` runs in **demo mode** with simulated check-ins.

## Firebase

See [docs/FIREBASE.md](docs/FIREBASE.md) for Auth (anonymous), Firestore rules, service account, and indexes.

## Deploy

```bash
npx vercel
```

Add the same env vars in the Vercel project settings.
