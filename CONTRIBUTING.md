# Contributing

Welcome! This guide is intentionally short. If you remember one sentence,
make it this one:

> **Components are dumb, composables own behavior, utils are pure.**

## Where does my code go?

Ask yourself these questions, in order:

1. **Is it a pure function?** (no Vue, no store, no side effect)
   → `app/utils/` — and write a unit test in `tests/unit/`.
2. **Is it behavior?** (side effects, map layers, timers, fetches, watchers)
   → `app/composables/` — keep the pure parts in a util so they stay testable.
   Map layer composables expose `attach(map)` / `detach()`.
3. **Is it shared state?** (several components need to read/write it)
   → `app/stores/` (Pinia) — the only place state is mutated.
4. **Is it UI?**
   → `app/components/` — dumb by default: props in, events out, no store
   access. Only designated orchestrators (`MapView`, `AppDrawer`,
   `StopSheet`) may touch stores and composables and pass data down.
5. **Is it server logic?**
   → `server/services/` — API handlers in `server/api/` stay thin:
   validate the request, call a service, validate the response (Zod).

Types and Zod schemas used by both sides live in `shared/`.

## Testing expectations

| You wrote… | You add… |
|------------|----------|
| A util function | A Vitest unit test (`tests/unit/*.test.ts`) — utils aim for ~100% coverage |
| A composable | A unit test for its pure logic (extracted into a util if needed) |
| A dumb component | A props/emits contract test (`tests/unit/components/`, happy-dom + @vue/test-utils) |
| A server service | A unit test with mocked dependencies (see `tests/unit/vehicles-endpoint.test.ts`) |
| A user-visible flow | A Playwright spec (`tests/e2e/`) |

Run locally: `pnpm lint && pnpm typecheck && pnpm test` (and `pnpm test:e2e`
with a dev server for E2E).

## Merge request rules

- **One concern = one MR** — small, reviewable, revertible.
- **Never mix a refactoring with a behavior change** in the same MR.
- **Pipeline must be green** before merging — no exceptions.
- **Move comments with the code.** The inline comments explaining SSR/hydration
  quirks and GPU fixes are documentation; when you extract code, take them along.

## Conventions

- Vue SFCs use `<script setup lang="ts">`; props/emits are typed with
  `defineProps<...>()` / `defineEmits<...>()`.
- Composables are named `useThing.ts` and return plain objects of refs,
  computeds and functions.
- User-facing strings are French; code, comments and commit messages are English.
- Commit messages follow `type(scope): summary` (e.g. `refactor(map): …`,
  `test(components): …`, `docs: …`).

Still unsure where something lives? Check the architecture diagram and the
folder conventions table in [README.md](./README.md) — that is their job.
