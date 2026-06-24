# ADR-004: PWA as primary web distribution

**Status**: Accepted  
**Date**: 2026-06-24

## Context

Publishing to app stores requires paid developer accounts ($99/yr Apple, $25 Google). For a personal project, the web is the most accessible distribution channel. iOS Safari supports "Add to Home Screen" with PWA capabilities.

## Decision

Distribute the web version as a **Progressive Web App**:
- Web app manifest for installability
- Service worker with cache-first for assets, network-first for navigation
- apple-mobile-web-app-capable meta tag for iOS fullscreen
- Static hosting on Azure Static Web Apps (free tier)

## Consequences

- Free distribution, no app store fees
- iOS PWA limitations: no push notifications, no background sync, 50MB storage soft limit
- Must serve over HTTPS (handled by Azure)
- Updates are instant (no app review process)
- Users must manually "Add to Home Screen" (no install prompt on iOS)
- Service worker caching gives offline support
