# Deployment Guide

## Required Environment Variables

Set these before production startup:

- `JWT_SECRET`
	- `DB_HOST`
	- `DB_PORT`
	- `DB_USER`
	- `DB_PASSWORD`
	- `DB_NAME`

Optional local-development fallbacks remain supported for non-production use, but production startup now fails if the required secrets are missing.
The backend DB health check uses the `DB_*` variables above.

## Cookie Settings

The session cookie is configured as follows in production:


## Socket CORS
- The backend auth route also requires `JWT_SECRET` to be set consistently for login/session token generation.

The socket server reads the allowed frontend origin from `SOCKET_CORS_ORIGIN`, falling back to `NEXT_PUBLIC_SOCKET_URL` during local development.

For production, use a single public frontend origin and make sure the socket endpoint is reachable from that origin. Prefer same-origin proxying if your deployment platform supports it.

## Startup Sequence

1. Start the backend/socket server.
2. Confirm the backend logs the startup summary and health endpoints.
3. Start the frontend production server.
4. Verify the browser can load the app and the socket handshake includes the `messmate_session` cookie.

Production-friendly commands:

```bash
cd server
node index.js
```

```bash
npm run build
npm run start
```

## Health Endpoints

- `/health`
- `/health/socket`
- `/health/db`

These should be reachable after startup and should report `ok: true` in a healthy production deployment.

Verified in this workspace with temporary production secrets:

- `/health` returned `ok: true`
- `/health/socket` returned `ok: true` and `socketReady: true`
- `/health/db` returned `ok: false` before the DB variables were added; this now needs to be rechecked with `DB_*` configured

## Startup Validation Logs

On startup the backend logs:

- environment
- socket enabled state
- auth mode
- Redis adapter enabled/disabled
- health endpoints

If required secrets are missing in production, startup fails immediately.

## Deployment Checklist

- Set all required production secrets.
- Use the production cookie settings above.
- Ensure the frontend origin matches the socket CORS allowlist.
- Confirm `/health` and `/health/socket` respond successfully.
- Confirm `/health` and `/health/socket` respond successfully in production mode.
- Confirm `/health/db` responds successfully after the database environment variables are configured.
- Build the frontend with `npm run build` before release.
- Keep the dev diagnostics page blocked in production.
- Do not re-enable anonymous socket sessions or readable auth cookies.
