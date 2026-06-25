# Agent Learn

Public Agent Engineering Dashboard MVP.

This repository hosts a Next.js dashboard for agent engineering practice, token usage telemetry, learning notes, and automation experiments.

Public URL: https://agent.aiclawonline.website/

## Current MVP

- Next.js + TypeScript app using the App Router.
- Module-card homepage that links only to public feature pages.
- Token usage dashboard at `/usage`, backed by `data/token-usage.json`.
- Agent Signals module at `/signals`, backed by `data/agent-signals.json`.
- Public `modelName` display with client names reduced to `clientCategory`.
- Schema, arithmetic and privacy validation for public token and Agent Signals data.
- `tokscale` collector script that refuses to overwrite valid data on invalid CLI output.
- Manual and scheduled refresh path for token collection and live deployed data sync.
- Deployed behind Cloudflare and an Nginx reverse proxy.

## Commands

```bash
npm run dev
npm run verify
npm run collect:tokens
npm run collect:lark-agent-candidates
npm run refresh:tokens
```

`npm run validate:data` validates both public JSON datasets: token usage and Agent Signals.

`npm run collect:tokens` defaults to an all-time collection window, uses `Asia/Shanghai` for the collection date label, and stores the first real usage date in `data/token-usage.json`.

`npm run collect:lark-agent-candidates` searches Feishu/Lark messages for the Agent Signals keywords configured in `data/agent-signals.json`. It writes a private candidate digest under `.tmp/lark-agent-candidates/` by default, or `/var/lib/agent-learn/lark-agent-candidates/` when `AGENT_LEARN_STATE_DIR=/var/lib/agent-learn` is set. The digest stores ranked topics, public URLs and counts only; it does not store raw chat text, message IDs, chat IDs or senders.

`npm run verify` runs data validation, tests, typecheck, production build, and public artifact privacy scanning.

`npm run refresh:tokens` runs token collection, validates public JSON data, and syncs `data/token-usage.json` into `/opt/agent-learn/data/`. The `/usage` page reads that file at request time, so token data updates do not require a rebuild or service restart.

## Planning Board Access

The planning board lives at `/plan` and requires login. It is independent from the public feature modules, is not linked from the public module list, and does not participate in module numbering or ordering. The homepage exposes a separate admin login/access control so admins do not need to type the private path manually. It saves each board item's status to server-side state, not to the planning document body.

You can still set these environment variables directly in production:

```bash
PLAN_ACCESS_EMAILS=<owner@example.com,reviewer@example.com>
PLAN_ACCESS_PASSWORD=<login-password>
PLAN_SESSION_SECRET=<long-random-secret>
PLAN_SESSION_TTL_SECONDS=604800
```

Optional:

```bash
PLAN_TRUST_CLOUDFLARE_ACCESS=true
PLAN_BOARD_STATE_PATH=/var/lib/agent-learn/plan-board-state.json
```

`PLAN_TRUST_CLOUDFLARE_ACCESS=true` should only be enabled after the protected routes are actually behind Cloudflare Access. It lets the app trust the `CF-Access-Authenticated-User-Email` header, matching the `dvp.aiclawonline.website` pattern. Without that flag, the app ignores the header and uses the email/password form.

In local development, fallback credentials are enabled only outside production:

- email: `admin@example.test`
- password: `agent-plan-dev`

Recommended on this machine: manage planning-board credentials through `dvp secret`, then deploy:

```bash
dvp secret set agent-learn plan_access_emails
dvp secret set agent-learn plan_access_password
dvp service agent-learn deploy
```

The deploy renderer still accepts the legacy `plan_access_username` secret as a temporary compatibility fallback, but new setup should use `plan_access_email` or `plan_access_emails`.

`plan_session_secret` is auto-generated into `dvp secret agent-learn plan_session_secret` on first deploy if missing.

The refresh script creates `/var/lib/agent-learn` with write access for the app user before syncing live data. That directory holds interaction state such as `plan-board-state.json` and manual refresh request files, so it must live outside `/opt/agent-learn`.

## Refresh Automation

Systemd unit templates live in `deploy/systemd/`:

- `agent-learn-refresh.service` runs the one-shot token data refresh pipeline.
- `agent-learn-refresh.timer` triggers the refresh hourly.
- `agent-learn-refresh.path` watches `/var/lib/agent-learn/refresh.request` for manual refresh requests.
- `agent-learn-lark-candidates.service` runs the one-shot Feishu/Lark Agent candidate digest.
- `agent-learn-lark-candidates.timer` triggers the Lark digest daily at 00:20 UTC, roughly 08:20 Beijing time.

The dashboard refresh button calls `POST /api/token-refresh`, which touches the request file with a short cooldown. Systemd then starts `agent-learn-refresh.service`; the button polls the current token data timestamp and reloads the page when new data is available. Displayed generated times are formatted as Beijing time.
