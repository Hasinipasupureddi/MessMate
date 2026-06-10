**Working Systems**

- **Backend API:** Express server on port `4001` with auth, health, and internal bridge routes working.
- **Next.js App:** Dev server on port `4028`; diagnostics remains available only at `/dev/socket-test` in development.
- **Socket Server:** Socket.IO is initialized, authenticated, and joining the canonical user/role/hostel rooms.
- **Health & Observability:** `/health/socket` reports socket readiness, metrics, and summary data.

**Protected Routes**

- **Auth-protected UI:** `student-dashboard`, `mess-staff-dashboard`, `warden-analytics`, and `profile`.
- **API:** `/api/auth/*` and the other protected API paths continue to require session verification.
- **Internal bridge:** `/internal/socket/emit` remains guarded by `X-MESSMATE-SOCKET-SECRET`.

**Realtime Flow**

1. Sign-in issues the HttpOnly `messmate_session` cookie.
2. The browser sends that cookie on the socket handshake with `withCredentials: true`.
3. Server auth verifies the session via `verifySocketSession()`.
4. The socket joins the stable rooms: `user:...`, `role:...`, and `hostel:...`.
5. Events emitted through the bridge or socket diagnostics reach the expected rooms and show up in the diagnostics log.

**Production Protections**

- Startup fails fast in production if `MESSMATE_JWT_SECRET` or `SOCKET_BRIDGE_SECRET` is missing.
- Session cookies are `HttpOnly`, `Secure` in production, and `SameSite=lax` in production.
- The dev diagnostics page is blocked in production.
- The anonymous socket fallback flag has been removed from the runtime path.
- Bridge emits now require an explicit bridge URL and secret configuration.

**Remaining Issues**

- Socket CORS and bridge deployment details still need final production wiring.
- Redis adapter support remains scaffold-only and disabled by default.
- There are unrelated backlog items elsewhere in the codebase outside auth/socket stabilization.

**Verification Notes**

- Authenticated realtime was verified in development on `4001` and `4028`.
- Socket reconnect restored room membership correctly.
- Ping, health metrics, and event delivery were confirmed from the diagnostics page.
