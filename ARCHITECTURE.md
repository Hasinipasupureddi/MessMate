# MessMate Architecture (Phase 4 readiness)

Overview
--
MessMate follows a clear separation of concerns:

- Next.js frontend (App Router) — UI, SSR, and API routes.
- Express socket server — Socket.IO process responsible for realtime broadcasts.
- MySQL database — primary data store and source-of-truth.
- Internal bridge — secure POSTs from Next API routes to the socket server to broadcast events.

Auth
--
- JWT-based sessions issued by Next.js auth endpoints (cookie `messmate_session`).
- Socket connections authenticate using JWT provided either via handshake `auth.token` or cookie.
- Socket server validates token on handshake and attaches `socket.data.session` with user claims.

Realtime flow
--
1. Frontend user performs an action (complaint, vote, opt-in) -> Next API route.
2. Next API route writes to MySQL and then POSTs to the internal bridge endpoint (`/internal/socket/emit`) with `x-messmate-socket-secret`.
3. Express socket server validates bridge secret and emits events into appropriate rooms (user:, role:, hostel:).
4. Clients join rooms on connect (user, role, hostel) and receive broadcasts.

Stabilization & Ops
--
- Centralized structured logging with `pino` (fallback to console in dev).
- Health endpoints: `/health`, `/health/socket`, `/health/db` (report uptime, mem, clients, db connectivity).
- Rate limiting applied to auth and bridge endpoints.
- Emitter abstraction exists at `server/socket/emitter.js` to enable Redis adapter later.
- Dev-only anonymous fallback has been removed for production; only allowed when `NODE_ENV !== 'production'`.

Deployment
--
- Dockerfile and docker-compose templates provided for app, server, and MySQL.
- PM2 ecosystem config added for server process management.

Next steps
--
- Wire monitoring/metrics backend (Prometheus, Grafana) and log aggregation (ELK, Datadog).
- Add Redis adapter and sticky sessions for scaling Socket.IO.
- Add CI integration tests and e2e flow automation.
