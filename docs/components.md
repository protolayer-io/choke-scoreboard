# Components

## Header (`src/components/Header.svelte`)

Top navigation bar with the app title and theme toggle.

**Features:**
- App title "🥋 Choke Scoreboard" (links to home)
- Dark/Light theme toggle button
- Sticky positioning with backdrop blur

**Props:** None

## PubkeyInput (`src/components/PubkeyInput.svelte`)

Input form for the organizer's Nostr public key.

**Features:**
- Text input accepting npub or hex pubkey
- "Load" button to start subscription
- "Debug Mode" button to load demo matches
- "Disconnect" button when connected
- Error display for invalid input
- Enter key support

**Props:** None

**State:** Connected/disconnected view modes

## MatchCard (`src/components/MatchCard.svelte`)

Main match display card with fighter scores.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `match` | `MatchEvent` | Match data |
| `mode` | `ViewMode` | `'compact'` or `'broadcast'` |

**Features:**
- Fighter names with colored panels
- Calculated total scores (large, mono font)
- Advantage (gold) and penalty (red) badges
- Status badge
- Countdown timer
- Winner indication (pulsing score, bouncing trophy)
- Point breakdown in broadcast mode
- Clickable → navigates to match detail
- Green glow border for live matches
- Dimmed appearance for canceled matches

Like the broadcast board it links to, the card is drawn twice and takes its colors from
`getCardPalette($theme)` — see [the broadcast board](#broadcast-board). It used to be navy under
*both* themes, on the argument that a scoreboard is dark; design 3A retired that argument, and a dark
card on a light list was the last thing in the app that ignored the theme.

## StatusBadge (`src/components/StatusBadge.svelte`)

Visual indicator for match status.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `status` | `MatchStatus` | Current match status |

**Renders:**
- `waiting` → Gray badge with clock icon
- `in-progress` → Green "LIVE" badge with pinging dot
- `finished` → Amber badge with bouncing trophy
- `canceled` → Red "CANCELED" badge

## Timer (`src/components/Timer.svelte`)

Countdown timer display.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `match` | `MatchEvent` | — | Match data for timer calculation |
| `large` | `boolean` | `false` | Large text mode for detail view |
| `class` | `string` | `''` | Typography override; when set, the caller owns font family and size |
| `tone` | `'muted' \| 'bright'` | `'muted'` | Base color when the timer is neither in warning nor expired |

`tone="bright"` means "the loudest color on the surface behind me", not "white": it resolves to
`var(--board-ink, #ffffff)`. The broadcast board sets `--board-ink` — along with `--color-gold` and
`--color-red-penalty` — from its palette, so the clock is white on the dark board and near-black on
the light one. See [the broadcast board](#broadcast-board) below.

**Behavior:**
- `waiting` → Shows total duration (e.g., "5:00")
- `in-progress` → Counts down every 1 second
- `finished`/`canceled` → Shows "--:--"
- Last 30 seconds → Gold color + pulse animation
- Paused (`paused_at` set while `in-progress`) → Frozen at the time the referee stopped it

**The tick must land ON the second boundary — not merely once per second.**

The displayed value is a function of `Math.floor(Date.now() / 1000)` (see
[match-lifecycle.md](./match-lifecycle.md)), so it changes on the epoch-second boundary and nowhere
else. A tick that lands mid-second leaves the *previous* second on the wall for the rest of this one,
and the board reads behind the referee's app.

`setInterval(fn, 1000)` cannot hold that invariant: it fires a second after it was armed, and here
that moment is the arrival of a relay event — so the phase comes from network jitter, is re-rolled by
every score update, and drifts later under the browser's clamp. `src/lib/tick.ts` schedules each tick
from the current clock instead, aimed just past the coming boundary. **Replacing it with an interval
would look like a simplification and would silently restore a delay of up to a second.**

The ticker stops itself once the clock reaches 0:00, because a match stays `in-progress` until the
referee names the outcome.

## Broadcast board

`src/routes/match/[id]/+page.svelte` — the full-viewport match view, the one screen that is watched
rather than used. It has no header and no footer (see the `isBroadcast` branch in
`src/routes/+layout.svelte`).

**It was drawn twice.** Design 1A puts it on near-black; design 3A is the same board on paper white,
for a bright hall or a projector that washes black out. The board follows the app's `theme` store, so
an organizer who switches the app to light mode gets the light board too.

Both palettes live in `src/lib/board-theme.ts`, and the component renders once against whichever
`getBoardPalette($theme)` returns. Nothing about the layout, the copy or the animations is themed —
only color.

What separates them is not only flat values. A fighter's color arrives from a Nostr event and gets
composed at render time, so the module exposes the recipes as well:

| Export | What it answers |
|--------|-----------------|
| `getBoardPalette(theme)` | Every flat color: surface, ink, chips, card, banner, per-status |
| `getCardPalette(theme)` | The same, for the match card on the list (design 2A and its light twin) |
| `halfWash(wash, color, angle)` | The diagonal wash behind one half — lighter and longer on white. Takes the spec, not the palette, because both surfaces wash the same way at different strengths |
| `glow(spec, color)` | Edge bar, name chip, score, winner name, live dot; `'none'` where light drops it |
| `tint(palette, color)` | A fighter's color made safe to read **as text**. Identity on dark; darkened on light, where a yellow belt on white is invisible |

`tint()` is the one to remember. The same hex can be a solid block (an edge bar, a 24px chip) and a
string of text (the winner's name), and only the second one needs the surface to push back.

**The theme is in-memory.** `theme` in `src/lib/stores.ts` is not persisted, so a page load — including
a shared deep link straight to `/match/<id>` — starts on the dark board regardless of what the last
visit chose.
