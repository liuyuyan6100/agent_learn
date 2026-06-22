# Agent Learn

Public Agent Engineering Dashboard MVP.

This repository hosts a Next.js dashboard for agent engineering practice, token usage telemetry, learning notes, and automation experiments.

Public URL: https://agent.aiclawonline.website/

## Current MVP

- Next.js + TypeScript app using the App Router.
- Module-card homepage that links to dedicated feature pages.
- Token usage dashboard at `/usage`, backed by `data/token-usage.json`.
- Agent Signals module at `/signals`, backed by `data/agent-signals.json`.
- Public `modelName` display with client names reduced to `clientCategory`.
- Schema, arithmetic and privacy validation for public token and Agent Signals data.
- `tokscale` collector script that refuses to overwrite valid data on invalid CLI output.
- Manual and scheduled refresh path for token collection, build, deploy sync, and service restart.
- Deployed behind Cloudflare and an Nginx reverse proxy.

## Commands

```bash
npm run dev
npm run verify
npm run collect:tokens
npm run refresh:tokens
```

`npm run validate:data` validates both public JSON datasets: token usage and Agent Signals.

`npm run collect:tokens` defaults to an all-time collection window, uses `Asia/Shanghai` for the collection date label, and stores the first real usage date in `data/token-usage.json`.

`npm run verify` runs data validation, tests, typecheck, production build, and public artifact privacy scanning.

`npm run refresh:tokens` runs collection, verification/build, syncs the built app to `/opt/agent-learn`, and restarts `agent-learn.service`.

## Refresh Automation

Systemd unit templates live in `deploy/systemd/`:

- `agent-learn-refresh.service` runs the one-shot refresh pipeline.
- `agent-learn-refresh.timer` triggers the refresh hourly.
- `agent-learn-refresh.path` watches `/var/lib/agent-learn/refresh.request` for manual refresh requests.

The dashboard refresh button calls `POST /api/token-refresh`, which touches the request file with a short cooldown. Systemd then starts `agent-learn-refresh.service`. Displayed generated times are formatted as Beijing time.
