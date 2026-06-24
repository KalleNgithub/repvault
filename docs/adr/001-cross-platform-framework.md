# ADR-001: Cross-platform framework — React Native + Expo

**Status**: Accepted  
**Date**: 2026-06-24

## Context

Need to target iOS, Android, and web browsers from a single codebase. Options considered:
- Flutter (Dart, good performance, less mature web)
- React Native + Expo (TypeScript, large ecosystem, Expo simplifies native)
- Capacitor + SPA (web-first, native as wrapper)

## Decision

Use **React Native 0.85 + Expo SDK 56** with TypeScript.

## Consequences

- Single codebase for all platforms
- Expo handles native build complexity (no Xcode/Android Studio for dev)
- Some React Native libraries don't support web — must verify before adopting
- Web performance slightly worse than native SPA (React Native Web overhead)
- Can eject to bare workflow if Expo limitations arise
