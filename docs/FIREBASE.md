# Firebase setup (spartan-c0ed7)

## Console checklist

1. **Authentication** → click **Get started** (required once per project — fixes `auth/configuration-not-found`)
2. **Sign-in method** → **Anonymous** → Enable → Save
3. **Authentication** → **Settings** → **Authorized domains** — ensure `localhost` is listed (for local dev)
4. **Firestore** → create database
3. Deploy rules & indexes from this repo (see below)

## Local env (already in `.env.local`)

`NEXT_PUBLIC_FIREBASE_*` variables connect the web app.

Optional but recommended for staff dashboard:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Paste the full service account JSON on one line. Restart `npm run dev` after adding it.

## Deploy Firestore rules & indexes

```bash
npm install -g firebase-tools   # if needed
firebase login
npm run firebase:deploy
```

**Production rules** (`firestore.rules`): students can write `reports`, read `rooms` + `drills`; cannot read other students' reports.

**Staff dashboard reads** go through the Admin API (`FIREBASE_SERVICE_ACCOUNT_JSON`). You do not need `firestore.rules.dev` for normal local dev.

**Optional client listener** (only if you skip the service account): set `NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_LISTEN=true` and deploy dev rules that allow authenticated reads on `reports`:

```bash
# Temporarily swap rules, deploy, then restore firestore.rules
cp firestore.rules.dev firestore.rules && npm run firebase:deploy
```

## Seed room catalog (rooms + teachers)

After adding `FIREBASE_SERVICE_ACCOUNT_JSON`:

1. Open `/admin`
2. Click **Seed rooms to Firestore**

Or:

```bash
curl -X POST http://localhost:3000/api/admin/seed
```

Creates:

| Collection | Contents |
|------------|----------|
| `rooms/{roomNumber}` | `number`, `label`, `building`, `teacher` |
| `drills/active-drill` | Active drill metadata |
| `reports/{drillId}_{uid}` | Student check-ins (created from phones) |

## Student check-in fields (`reports`)

| Field | Description |
|-------|-------------|
| `studentName` | Full name |
| `studentId` | School ID (optional) |
| `grade` | 9–12 |
| `status` | `safe` or `unsafe` |
| `roomNumber` | e.g. `408` |
| `teacherName` | From room or edited |
| `location` | GPS `{ latitude, longitude, accuracy }` |
| `note` | Optional, often for unsafe |
| `studentUid` | Anonymous auth uid |
| `drillId` | `active-drill` (default) |

## Routes

| URL | Audience |
|-----|----------|
| `/check-in` | Students only |
| `/admin` | Staff only |

## Verify

```bash
curl http://localhost:3000/api/admin/status
```

1. Submit on `/check-in`
2. See document in Firestore → `reports`
3. See entry on `/admin` live feed
