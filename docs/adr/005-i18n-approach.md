# ADR-005: Display-time translation with canonical English data

**Status**: Accepted  
**Date**: 2026-06-24

## Context

The app supports English and Finnish. Exercise names are seeded in the database. We need a strategy for translating these names without complicating the database schema or requiring migrations when adding languages.

## Decision

- Database stores canonical English exercise names
- Translations happen at **render time** via `translateExercise(name, locale)`
- Translation lookup maps live in `src/i18n/exercises.ts`
- User-created exercises display as-is (no translation)
- UI strings use a simple key-value i18n system (`src/i18n/en.ts`, `src/i18n/fi.ts`)

## Consequences

- Adding a new language only requires a new translation file — no DB migration
- Exercise names in DB are always grep-able in English
- Sort order must be computed at display time (sorted by translated name)
- User-created exercises won't be translated (acceptable — user named them)
- Query results use English names; UI layer handles display
