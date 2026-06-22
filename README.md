# Agent Learn

Public Agent Engineering Dashboard MVP.

This repository hosts a Next.js dashboard for agent engineering practice, token usage telemetry, learning notes, and automation experiments.

Public URL: https://agent.aiclawonline.website/

## Current MVP

- Next.js + TypeScript app using the App Router.
- Token usage dashboard backed by `data/token-usage.json`.
- Public `modelName` display with client names reduced to `clientCategory`.
- Schema, arithmetic and privacy validation for public token data.
- `tokscale` collector script that refuses to overwrite valid data on invalid CLI output.
- Deployed behind Cloudflare and an Nginx reverse proxy.

## Commands

```bash
npm run dev
npm run verify
npm run collect:tokens
```

`npm run collect:tokens` defaults to an all-time collection window and stores the first real usage date in `data/token-usage.json`.

`npm run verify` runs data validation, tests, typecheck, production build, and public artifact privacy scanning.
