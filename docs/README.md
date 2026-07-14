# Choke Scoreboard — Technical Documentation

## Overview

Choke Scoreboard is a SvelteKit-based single-page application (SPA) that displays BJJ match scores in real-time by subscribing to Nostr events.

## Documentation Index

- [Architecture](./architecture.md) — Project structure, Svelte 5 runes, state management
- [Nostr Protocol](./nostr-protocol.md) — Event kind 31415, relay management, subscriptions
- [Scoring System](./scoring-system.md) — BJJ point calculation, tiebreakers
- [Match Lifecycle](./match-lifecycle.md) — State machine, timer behavior
- [Components](./components.md) — Svelte component documentation
- [Languages](./i18n.md) — Message catalogs, adding a language, what must never be translated
- [Data Models](./data-models.md) — TypeScript interfaces
- [Deployment](./deployment.md) — GitHub Pages, static adapter setup

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Building

```bash
npm run build
```

Output goes to `build/` directory, ready for static hosting.
