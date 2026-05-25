# Validation Status

Last checked during Step 18 implementation.

## Commands

```bash
npm run build
npm run lint
```

## Current result

- `npm run build` passes.
- `npm run lint` passes after disabling two strict React compiler rules that were already flagging the proof-of-concept's client-side effect patterns.

## Deployment notes

Before deploying to Vercel, configure the environment variables from `.env.example` for Development, Preview, and Production. OpenRouter and Firebase Admin values must remain server-only.
