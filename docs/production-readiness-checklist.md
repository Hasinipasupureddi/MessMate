# Production Readiness Checklist

## Socket Layer
- [ ] Request IDs are attached to bridge requests, socket events, and API mutation logs.
- [ ] Heartbeat metrics are exposed in `/health/socket` and the dev diagnostics page.
- [ ] Stale sockets are cleaned up automatically.
- [ ] Listener leaks are detected and logged.
- [ ] Per-client socket emit rate limiting is enforced.
- [ ] Redis adapter support is scaffolded and disabled by default.

## Auth and Access
- [ ] Anonymous session probing returns a non-error state.
- [ ] Protected routes keep role-based redirects intact.
- [ ] Unauthorized room access is rejected.

## Diagnostics
- [ ] Dev diagnostics remain behind `NODE_ENV !== 'production'`.
- [ ] Diagnostics requests include request IDs and heartbeat polling.

## Verification
- [ ] Full repo type-check passes.
- [ ] Remaining unrelated failures are isolated from socket/auth regressions.
- [ ] Reconnect and bridge timeout regression tests pass.