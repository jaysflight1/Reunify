# Reunify

**Reunify** is an AI-powered emergency student-family coordination platform. During school crises or lockdowns, it lets administrators track student check-in status in real time, helps parents locate their children, and gives responders a live operational dashboard.

***

## Features

- **Multi-role dashboards**: Separate, purpose-built views for Students, Teachers, Parents, Responders, and Admins
- **Real-time check-in**: Teachers and students send status updates via voice or text; status updates propagate instantly via Firestore
- **AI triage assistant**: OpenRouter-backed GPT-OSS-20B parsing handles freeflowing text and voice updates and updates students' status in the system
- **Shooter & Injury Updates**: Consolidates reports involving shooter location and injuries into a single panel for first responders.
- **Parent-safe SMS notifications**: Optional Twilio integration sends approved safe-status updates without exposing sensitive incident details
- **Secure by default**: Granular Firestore security rules ensure each role only reads/writes data it owns
- **Demo mode**: `ALLOW_DEMO_AUTH=true` lets you run the full app locally without a real Firebase project

***

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database | Firestore (Firebase) |
| Auth | Firebase Auth + Firebase Admin SDK |
| AI | OpenRouter chat completions API (`openai/gpt-oss-20b:free` by default) |
| SMS | Twilio REST API (optional, dry-run by default) |
| Validation | Zod |

***

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled
- An OpenRouter API key
- *(Optional)* A Twilio account for SMS

### Installation

```bash
git clone https://github.com/jaysflight1/Reunify.git
cd Reunify
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client-side config (browser-safe) |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK credentials (server-only) |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `OPENROUTER_MODEL` | Model ID (default: `openai/gpt-oss-20b:free`) |
| `OPENROUTER_SITE_URL` / `OPENROUTER_SITE_NAME` | Optional OpenRouter app attribution headers |
| `SMS_NOTIFICATIONS_ENABLED` | Set `true` to send SMS. Default `false` records dry-run audits only |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | Twilio credentials for parent-safe SMS (optional) |
| `ALLOW_DEMO_AUTH` | Set `true` to bypass real auth in development |
| `NEXT_PUBLIC_APP_URL` | Base URL (default: `http://localhost:3000`) |

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seeding Data

```bash
npm run seed
```

### Deploying Firestore Rules

```bash
npm run firebase:deploy
```

***

## 📁 Project Structure

```
src/
├── app/
│   ├── admin/          # Admin dashboard (drill management, overview)
│   ├── check-in/       # Student check-in flow
│   ├── parent/         # Parent portal (find child, status updates)
│   ├── responder/      # First responder live dashboard
│   ├── student/        # Student self-service view
│   ├── teacher/        # Teacher roster & accountability view
│   └── api/            # Next.js API routes (AI, auth, notifications)
├── components/         # Shared UI components
├── hooks/              # Custom React hooks
├── lib/                # Firebase client, admin SDK, OpenRouter client, utilities
└── types/              # Shared TypeScript types
```

***

## Security

Firestore security rules (`firestore.rules`) enforce role-based access control — students, teachers, parents, and responders each have narrowly scoped read/write permissions. A permissive dev ruleset (`firestore.rules.dev`) is provided for local development only; **never deploy it to production**.

***

## License

This project was created for hackathon purposes. No license is currently specified — all rights reserved by the authors.
