# Unrelated Type-Check Failures

Scope: current `npm run type-check` output, excluding everything under `_phase1_backup_*`.

## Auth
- None remaining after the cleanup pass.

## Tests
- `src/tests/integration/complaints-api.test.ts`: mocked auth session is missing `emailVerified`.
- `src/tests/integration/complaints-management-api.test.ts`: mocked auth sessions are missing `emailVerified`.

## UI
- `src/app/profile/page.tsx`: `map((part) => ...)` has an implicit `any` parameter.

## API Routes
- `src/app/api/cooking-tasks/route.ts`: `assignedTo` is not part of the task input type.
- `src/app/api/ingredients/calculate/route.ts`: imports `calculateIngredients`, which is not exported.

## Typings
- `src/tests/integration/dashboard-smoke.test.tsx`: `toBeInTheDocument` is not recognized on `JestMatchers`.

## Excluded Backup Failures
- All `_phase1_backup_2026-05-25/...` errors were intentionally ignored.