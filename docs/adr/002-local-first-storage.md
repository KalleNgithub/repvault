# ADR-002: Local-first storage with no cloud backend

**Status**: Accepted  
**Date**: 2026-06-24

## Context

Workout data is personal and doesn't require collaboration. Cloud backends add cost, latency, auth complexity, and privacy concerns. The app name "RepVault" implies local ownership of data.

## Decision

All data stored locally on-device:
- **Native** (iOS/Android): SQLite via expo-sqlite
- **Web**: IndexedDB (see ADR-003)

No user accounts, no server, no sync. Export/import may be added later.

## Consequences

- Zero hosting cost for data (only static asset hosting for PWA)
- Works offline by default
- No cross-device sync (acceptable for personal use)
- Data loss if user clears browser storage (mitigated by export feature later)
- No server-side validation — all logic in client
