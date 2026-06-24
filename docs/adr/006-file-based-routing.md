# ADR-006: File-based routing with expo-router

**Status**: Accepted  
**Date**: 2026-06-24

## Context

Need navigation between screens (home, workout, exercises, history, settings). Options: React Navigation (manual), expo-router (file-based, like Next.js).

## Decision

Use **expo-router** with file-based routing. Each screen is a file in `app/`:
- `app/index.tsx` — home/workout list
- `app/workout.tsx` — active workout screen
- `app/exercises.tsx` — exercise library
- `app/history.tsx` — past workouts
- `app/settings.tsx` — language settings
- `app/_layout.tsx` — root Stack layout with theme

## Consequences

- Convention over configuration — routes are filesystem structure
- Deep linking support out of the box
- Stack navigation with typed params
- Adding screens = adding files (no router config to maintain)
- Must follow expo-router conventions (special files like _layout, +html)
