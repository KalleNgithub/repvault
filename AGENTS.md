# RepVault — Agent Guidelines

This file defines project conventions, best practices, and constraints
for any AI coding agent working on this codebase. Agent-specific files
(e.g., `CLAUDE.md`) should reference this file rather than duplicating rules.

## Project Overview

**RepVault** is a local-first workout log PWA.  
Stack: React Native 0.85 + Expo SDK 56 + TypeScript 6 + expo-router  
Platforms: iOS, Android, Web (PWA)  
Storage: SQLite (native), IndexedDB (web) — no cloud backend  
Tests: Jest + ts-jest  

## Architecture Decisions

See [`docs/adr/`](docs/adr/) for recorded decisions. Key constraints:
- No cloud backend — all data local (ADR-002)
- Web uses a custom SQL-parsing IndexedDB adapter (ADR-003)
- Translations at display-time, DB stores English (ADR-005)

## Code Conventions

### TypeScript
- `strict: true` is required; do not weaken with `any` casts
- Prefer explicit return types on exported functions
- Use `interface` for object shapes, `type` for unions/intersections
- Do not use `import ... assert {}` (deprecated in TS 6) — use `import ... with {}` if needed
- No path aliases (keep imports relative until project grows)

### React / React Native
- Functional components only (no class components except Error Boundaries)
- Custom hooks in `src/hooks/` — prefix with `use`
- Platform-specific code: use file extensions (`.web.tsx`, `.ios.tsx`) for large divergences; `Platform.OS` checks for small ones
- Styles via `StyleSheet.create()` using `colors` from `src/theme.ts`
- No inline color hex values — all colors come from theme
- No `Alert.alert()` on web (doesn't work) — use inline UI or router navigation

### Database
- All queries go through `src/db/queries.ts`
- `src/db/interface.ts` defines the platform-agnostic DB type
- New SQL patterns MUST be tested against webdb.ts — it only supports a subset of SQL
- IndexedDB does NOT enforce UNIQUE constraints — handle at application level
- When adding seeded exercises, add to both `schema.ts` and `src/i18n/exercises.ts`

### i18n
- All user-facing strings go through `src/i18n/{en,fi}.ts`
- Exercise translations in `src/i18n/exercises.ts`
- When adding a key to `en.ts`, add to `fi.ts` too (tests enforce parity)
- DB stores English-canonical data; translations are display-time only

### Testing
- Test files: `tests/*.test.ts`
- Run: `npm test`
- Pure logic tests only (no DOM, no React components currently)
- Mock DB operations using the in-memory mock pattern from `tests/schema.test.ts`
- Tests MUST pass before committing

### Styling / Theme
- All colors from `src/theme.ts` — synthwave palette (purple/orange/cyan)
- Use `colors.` references in StyleSheet, never raw hex
- Dark theme only — `userInterfaceStyle: "dark"` in app.json

## File Structure

```
app/                    # Screens (expo-router file-based routing)
  _layout.tsx           # Root Stack with theme
  index.tsx             # Home / workout list
  workout.tsx           # Active workout (main screen)
  exercises.tsx         # Exercise library
  history.tsx           # Past workouts
  settings.tsx          # Language settings
src/
  db/                   # Database layer
    interface.ts        # DB type definition
    webdb.ts            # IndexedDB adapter (web only)
    schema.ts           # Table creation, seeding, migrations
    queries.ts          # All CRUD operations
    DatabaseProvider.tsx # React context
  hooks/                # Custom React hooks
  i18n/                 # Translations
  theme.ts              # Color palette
  types/                # TypeScript interfaces
tests/                  # Jest test files
public/                 # PWA assets (manifest, sw, icons)
scripts/                # Build scripts (inject-pwa.js, icon.svg)
docs/adr/               # Architecture Decision Records
```

## Build & Deploy

```bash
npm run web              # Dev server (Metro)
npm run build:web        # Export + inject PWA tags → dist/
npm test                 # Jest test suite
npx tsc --noEmit         # Type check (excludes tests/)
```

## Constraints & Known Limitations

- webdb.ts is a fragile SQL parser — only supports patterns used in queries.ts
- IndexedDB has no UNIQUE enforcement, no foreign key cascades
- iOS PWA: no push notifications, no background sync, 50MB storage soft limit
- expo-sqlite SharedArrayBuffer requires COOP/COEP headers (web doesn't use it)
- Metro caching: config changes require `--clear` and browser hard refresh

## Git Conventions

### Branching
- `master` is the production branch — only receives merges, never direct commits
- All work happens on branches: `feat/<description>`, `fix/<description>`, `dev`, etc.
- Delete branches after merge

### Commits
- Imperative mood, summary line < 72 chars: "Add exercise deletion" not "Added exercise deletion"
- Body (if needed): wrap at 72 chars, explain *why* not *what*
- One logical change per commit — don't mix unrelated features
- Run `npm test` and `npm run typecheck` before committing
- Reference ADRs when making architectural changes

### Workflow for agents
- **NEVER commit directly to `master`** — always work on a branch
- The user decides when work is ready to merge to master
- Squash fixup/wip commits before requesting merge
- Never force-push `master`
- Never commit `node_modules/`, `dist/`, `.expo/`, or secrets

### Commit message format
```
<summary line — what changed>

<optional body — why, trade-offs, context>

Co-authored-by: ...
```

### When to commit
- After each logical unit of work passes tests
- Before switching to a different area of the codebase
- After fixing a bug (separate commit from the feature that exposed it)

