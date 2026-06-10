# Auth migration (Phase 1+)

## Session cookie

- **Name:** `messmate_session` (httpOnly JWT, HS256)
- **Issued on:** `POST /api/auth/signin`, `POST /api/auth/signup`
- **Env:** set `MESSMATE_JWT_SECRET` in production (required). Dev uses an insecure default if unset.

## API trust modes

| Endpoint / area | Mode | Notes |
|-----------------|------|--------|
| `GET /api/auth/session` | **session-backed** | Identity from JWT cookie only. Optional `?compareStudentId=` for debug. |
| `POST /api/auth/signin`, `signup` | **dual** | Sets server cookie + unchanged JSON for existing `AuthContext` / `localStorage`. |
| `PUT /api/meal-optins` | **session-backed** | Requires cookie + role `student`. `studentId` is always `session.sub`; body `studentId` ignored (warn if mismatch). |
| `GET /api/meal-optins` | **legacy-trust** | Counts public-ish; per-student rows still use `?studentId=` (migrate next). |
| Other `/api/*` | **legacy-trust** | Still trust body/query where applicable; migrate one route at a time. |

## Phases (reminder)

1. **Foundation** — cookie + helpers + POC route (`GET /api/auth/session`).
2. **Identity** — mutating routes use session `sub` (started with **`PUT /api/meal-optins`**). Next: `GET /api/meal-optins?studentId=…`, then votes, ratings, etc.
3. **Authorization** — role guards on APIs; middleware as needed.
4. **Cleanup** — remove `localStorage` as source of truth; clear cookie on logout.
