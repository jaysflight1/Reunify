# Reunify

**Reunify** is an AI-powered emergency student-family coordination platform. During school crises or lockdowns, it lets administrators track student check-in status in real time, helps parents locate their children, and gives responders a live operational dashboard.

***

## Features

- **Multi-role dashboards**: Separate, purpose-built views for Students, Teachers, Parents, Responders, and Admins
- **Real-time check-in**: Teachers and students send status updates via voice or text; status updates propagate instantly via Firestore
- **AI triage assistant**: Gemini 2.5 Flash Lite parses freeflowing text and voice updates and updates students' status in the system
- **Shooter & Injury Updates**: Consolidates reports involving shooter location and injuries into a single panel for first responders.
- helps responders prioritize and answer parent queries intelligently
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
| AI | Google Gemini (`@google/genai`) |
| Validation | Zod |

***

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled
- A Google AI Studio API key for Gemini
- *(Optional)* A Twilio account for SMS

### Installation

```bash
git clone https://github.com/jaysflight1/synth-hacks.git
cd synth-hacks
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
| `GEMINI_API_KEY` | Google AI Studio key |
| `GEMINI_MODEL` | Model ID (default: `gemini-2.5-flash-lite`) |
| `TWILIO_*` | Twilio credentials for SMS (optional) |
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
├── lib/                # Firebase client, admin SDK, Gemini client, utilities
└── types/              # Shared TypeScript types
```

***

## Security

Firestore security rules (`firestore.rules`) enforce role-based access control — students, teachers, parents, and responders each have narrowly scoped read/write permissions. A permissive dev ruleset (`firestore.rules.dev`) is provided for local development only; **never deploy it to production**.

***

## License

This project was created for hackathon purposes. No license is currently specified — all rights reserved by the authors.
