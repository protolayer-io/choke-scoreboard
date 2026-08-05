# 🥋 Choke Scoreboard

Real-time BJJ (Brazilian Jiu-Jitsu) match scoreboard powered by [Nostr](https://nostr.com).

## What is this?

Choke Scoreboard is a **read-only scoreboard viewer** for BJJ tournaments. It subscribes to a tournament organizer's Nostr events (kind 31415) and displays match scores in real-time.

**It does NOT create matches** — it only displays them.

## Features

- 🔴 **Live scoring** — Real-time match updates via Nostr protocol
- ⏱️ **Countdown timer** — Automatic timer with warning animations
- 🏆 **Winner indication** — Visual highlighting of the leading fighter
- 📺 **Two view modes** — Compact grid and Broadcast (large) views
- 🌙 **Dark/Light theme** — Toggle between themes
- 🐛 **Debug mode** — 8 demo matches for testing
- 📱 **Responsive** — Works on mobile and desktop

## Tech Stack

- **[SvelteKit](https://svelte.dev)** with TypeScript and Svelte 5 runes
- **[TailwindCSS v4](https://tailwindcss.com)** for styling
- **[nostr-tools](https://github.com/nbd-wtf/nostr-tools)** for Nostr protocol
- **Static adapter** for GitHub Pages deployment

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## How It Works

1. Enter a tournament organizer's Nostr public key (npub or hex)
2. The app subscribes to their kind 31415 events on default relays
3. Match scores update in real-time as the organizer publishes events
4. Click any match card to see the full detail view

## BJJ Scoring

| Move | Points |
|------|--------|
| Takedown / Sweep | 2 |
| Guard Pass | 3 |
| Mount / Back Take | 4 |

**Total Score** = (2pt moves × 2) + (3pt moves × 3) + (4pt moves × 4)

Tiebreakers: Advantages → Fewer Penalties

## Nostr Protocol

- **Event kind:** 31415 (parameterized replaceable)
- **d-tag:** Match ID
- **Content:** JSON with match fields

Default relays:
- `wss://relay.mostro.network` (kind 31415 is non-standard; most relays reject it)

## Documentation

See the [docs/](./docs/) folder for detailed technical documentation.

## Deployment

This project deploys automatically to GitHub Pages via GitHub Actions on push to `main`.

## Origins

This scoreboard is a rewrite of
[bjj-scoreboard-floripa26](https://github.com/gotcha/bjj-scoreboard-floripa26) by
[@gotcha](https://github.com/gotcha), built at
[btc++ Floripa 2026](https://btcpp.dev/floripa26). Choke officially started there
as a two-person hackathon team: gotcha took the scoreboard, and the
[Choke](https://github.com/protolayer-io/choke) mobile scoring app was built
alongside it.

The code here was written from scratch, but the original scoreboard — and the
idea of pairing it with the app over Nostr — is gotcha's. Thank you. 🙏

## License

Copyright (C) 2026 ProtoLayer OÜ

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU General Public License for more details.

See the [LICENSE](./LICENSE) file for the full text.
