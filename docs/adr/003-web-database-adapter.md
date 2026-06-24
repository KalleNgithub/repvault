# ADR-003: IndexedDB adapter for web platform

**Status**: Accepted  
**Date**: 2026-06-24

## Context

expo-sqlite on web requires SharedArrayBuffer (COOP/COEP headers). These headers break Metro's dev server resource loading and cause issues on iOS Safari. We need a web-compatible database that matches the native SQLite interface.

## Decision

Implement `webdb.ts` — a custom SQL-parsing adapter over IndexedDB using the `idb` library. It implements the same `DB` interface as expo-sqlite, parsing a subset of SQL (SELECT, INSERT, UPDATE, DELETE with JOIN, WHERE, GROUP BY, ORDER BY, LIMIT).

## Consequences

- Web works without special headers
- Same `DB` interface for both platforms — queries.ts is platform-agnostic
- webdb.ts is fragile: only supports SQL patterns actually used by the app
- New query patterns may require parser updates
- IndexedDB doesn't enforce UNIQUE constraints on non-key columns (must handle at application level)
- No foreign key cascades in IndexedDB (DELETE CASCADE handled manually)
- Performance is adequate for personal-scale data (hundreds of workouts)
