# Shared Links

**Status: the readers are landing; nothing produces a match link yet.**

- The board link (`?npub=…`) is **built and in production** — `src/lib/share-link.ts`
  and `src/components/PubkeyInput.svelte`.
- The match link (`?npub=…&match=…`) is **read and resolved on the web**.
  `readSharedMatchLink` and `stripSharedLinkFromUrl` (`src/lib/share-link.ts`)
  parse and clear it; `src/routes/+page.svelte` resolves it in place through
  `findMatchByOrganizer` (`src/lib/stores.ts`) and `relaysSettled`
  (`src/lib/nostr.ts`), and renders it with `src/components/MatchView.svelte`.
- The Choke app **parses** the same URL (its step 1, PR #154 there) but does not
  yet **show** the named match: its resolution and waiting behaviour is still
  owed. See its `docs/specs/shared-match-links.md`.
- **Nothing anywhere produces a match link.** There is no share affordance in
  either repo. `buildShareLink` here assembles the format for the tests to
  round-trip and has no caller in the UI (§2.1), which is deliberate: readers
  land before writers (§6.2).

The companion specification lives in the Choke app repository at
`docs/specs/shared-match-links.md`, and the URL contract in §1 is shared between
the two — neither side may extend it alone. Build order, including the
cross-repo ordering both documents depend on, is §6.

## Why links exist at all

A spectator should not have to paste a 63-character key to watch the mats in
front of them. The organizer sends a URL; landing on the page *is* loading the
matches. That is the whole feature, and everything below is about how much of a
promise a single URL can carry.

Today it carries an organizer. The unit people actually share is a match — "watch
my son's fight, it's the third one" — and every word of that instruction is
friction that goes stale while the message is being read, because the list
reorders itself as matches start and finish.

## 1. URL contract

| Part | Value |
|---|---|
| Origin | `https://bjjscore.live` |
| Path | `/` — the root, always |
| Organizer | `npub=<npub1…\|64-hex>` |
| Match | `match=<match id>` |

```text
https://bjjscore.live/?npub=npub1…            board link
https://bjjscore.live/?npub=npub1…&match=abcd match link
```

The organizer *value* comes in two shapes — an `npub1…` bech32 string or a
64-character hex key — and this repo does not choose between them: `decodePubkey`
resolves both, so `readSharedPubkey` hands back whatever was in the query string
and a malformed key fails in one place only.

A link carrying `npub` but no `match` is a **board link** and keeps its current
behaviour exactly. A link carrying `match` without a readable `npub` is broken:
a match id is only unique within one author's events, so an id alone names
nothing and there is no author to subscribe to.

**The grammar of `match` is normative** and identical in both repos:

```text
match = 4 * HEXDIG-lowercase          ; /^[0-9a-f]{4}$/
```

That is exactly what the Choke app's `Match._generateMatchId()` emits: four
characters drawn from `0123456789abcdef`.

**Builders always emit lowercase and unencoded** — every legal character is
already URL-safe, so there is nothing to escape. Readers accept slightly more
than that, deliberately: links get mangled by chat clients and auto-capitalising
keyboards, and this repo's `npub` reader already trims for exactly that reason.

**Validation applies to the decoded value, in this order:**

```text
decoded value  ->  trim surrounding whitespace  ->  lowercase  ->  /^[0-9a-f]{4}$/
```

Decoded, not raw. Both platforms' query parsers percent-decode before a caller
ever sees the value — `URLSearchParams` here, `Uri.queryParameters` in the app —
and reading the raw query string to get underneath that would be fighting the
platform for no gain. So, explicitly:

| Query | Decodes to | Verdict |
|---|---|---|
| `match=abcd` | `abcd` | accepted |
| `match=%61%62%63%64` | `abcd` | accepted |
| `match=abcd%20` | `abcd ` | accepted — trimmed |
| `match=ABCD` | `ABCD` | accepted — lowercased |
| `match=abc`, `match=abcde`, `match=zzzz`, `match=ab-cd` | — | **Broken** |

Trimming is of *surrounding* whitespace only. Nothing else is normalised: no
stripping of interior separators, no aliasing of visually similar glyphs. Any
value that still fails the pattern after those two steps makes the link
**broken** — the sender named something unreadable. Broken is the case above, a
link that names nothing, and is *not* the same state as a well-formed id the
feed does not contain (Unresolved, §3.2). Conflating them tells the recipient the
match ended when in fact the URL arrived damaged.

**Known limitation:** four hex characters is 16 bits, generated at random with no
collision check. Two matches created by the same organizer inside the 24-hour
window (§5) can therefore collide, and a link would resolve to whichever the
reader sees. It takes hundreds of matches in one day to become likely — which a
large tournament genuinely reaches. Widening the id is a cross-repo change to the
grammar above, not a local fix on either side.

### 1.1 Why the root path, and not `/match/<id>`

A path-shaped URL reads better and is the wrong answer.

The Android app declares its App Links intent filter with `android:path="/"` —
it claims **the root and nothing else**, deliberately, so that pages the app
cannot render stay with the browser instead of being swallowed by an app that
would show nothing.

So `bjjscore.live/match/abcd` would not open the app. It would open the browser
on a device that has the app installed, which is the single outcome App Links
exists to prevent. Note this is a constraint the *web* repo has to respect even
though the manifest lives elsewhere: the verification file this site serves,
`static/.well-known/assetlinks.json`, is the other half of that handshake.

Keeping the match id in the query string of the root URL means no manifest
change and no re-verification of `assetlinks.json`.

### 1.2 Backward compatibility

App v2.0.0 is already in production and not every user updates. An older client
receiving `?npub=X&match=Y` reads the pubkey it understands and ignores the
parameter it does not: it opens the board. Degraded, but correct — the recipient
still reaches the right organizer, one tap from the right match.

A web viewer on a cached bundle behaves the same way, because `readSharedPubkey`
only ever looks at `SHARE_PUBKEY_PARAM` and is indifferent to everything else in
the query string.

There is no version of this link that produces an error on an old client. That
property is what makes it shippable at all.

The cached-bundle fallback is nonetheless a **known limitation, not a clean
one**. An old bundle opens the organizer's board — correct — but leaves
`?match=…` stranded in the address bar, because the strip it carries removes
only the pubkey param. A viewer who refreshes from there, or forwards what they
see, produces a URL carrying `match` and no `npub`: the broken form §1 defines.
Landing on the board is right; the URL left behind is wrong.

Current bundles no longer do this — `stripSharedLinkFromUrl` removes both params
together or neither (§4) — but nothing in this repo can retroactively fix a
bundle already cached on someone's device. That is why the strip fix was step 1
of §6.3 and not a tidy-up at the end: every day it did not ship was another day
of caches to outlive.

### 1.3 Why `match=` and not `id=`

`id` is fine inside one page and poor in a public contract. This URL gets pasted
into group chats and spreadsheets and will outlive the code that reads it. The
day the site gains event or tournament pages, a bare `id` has to be
disambiguated by whatever else happens to be in the query string — and by then
the old links are in the wild. `match=` says what it names, and cost nothing to
choose while no link had yet been produced.

Nor is there a precedent for accepting two names. This repo once read the
organizer key under `pubkey=` as well as `npub=`, to absorb historical drift
between two readers. Nothing ever *produced* a `pubkey=` link — no builder on
either side emitted one — so the alias bought a second thing to keep in sync and
a standing question about which name was canonical, in exchange for handling
links that did not exist. It was removed, and `src/lib/share-link.ts` now
exports a single `SHARE_PUBKEY_PARAM = 'npub'`. **Do not add an alias for
`match`** — it would recreate exactly the cost that removal just paid off, and
this time with links already in the wild to migrate.

### 1.4 Nostr addressing

Matches are addressable events — kind `31415`, keyed by a `d` tag (see
[Nostr Protocol](./nostr-protocol.md)). `npub` + `match` are therefore exactly
the coordinates the protocol already uses to name one; the URL is a readable
`naddr`, not a parallel identifier scheme invented for the web.

Supporting a literal `naddr1…` parameter is **out of scope**: it is unreadable
in a chat message, and the two-field form is what a human can check by eye when
a link misbehaves.

## 2. What exists today

### 2.1 `src/lib/share-link.ts`

| Symbol | What it does |
|---|---|
| `SHARE_PUBKEY_PARAM` | `'npub'` — one name, no alias (§1.3) |
| `SHARE_MATCH_PARAM` | `'match'` — likewise (§1.3) |
| `readSharedPubkey(search)` | Returns the value, trimmed and otherwise untouched, or `null` if empty or absent |
| `readSharedMatchId(search)` | Applies §1's parsing order to the decoded value; `null` if absent or failing the grammar |
| `readSharedMatchLink(search)` | Composes the two into `{ kind: 'none' \| 'broken' \| 'match' }` |
| `stripSharedLinkFromUrl()` | Deletes **both** params from the address bar via `history.replaceState` |
| `buildShareLink(origin, npub, matchId?)` | Assembles `origin/?npub=…[&match=…]`, always on the root path |

`readSharedPubkey` deliberately does **not** validate. Decoding is
`decodePubkey`'s job, so a malformed link surfaces the very same error a bad
paste would, in the viewer's language. `readSharedMatchId` does the opposite and
validates fully, because there is no later step that would: the grammar in §1 is
all a match id has.

The three kinds of `readSharedMatchLink` are the URL contract, not an
implementation convenience. `broken` is returned for an id that fails the grammar
*and* for a well-formed id with no readable organizer — both name nothing — and
it is deliberately not the same answer as an id the feed does not contain (§3.2).

`buildShareLink` is exported and covered by `src/lib/share-link.test.ts`, but it
has **no caller in the UI** — nothing on the web board offers a link to copy.
It exists so the format has a single source of truth the tests can round-trip,
and it pins the root path for the reason §1.1 gives.

### 2.2 `src/components/PubkeyInput.svelte`, and what it never sees

`onMount` is where a **board** link becomes a subscription:

1. `readSharedPubkey(window.location.search)` — a shared link **beats** the
   persisted key. Someone following a link means to watch *that* organizer now,
   not whatever this device last looked at.
2. `decodePubkey` → `connectToPubkey` → `subscribeToMatches`.
3. `stripSharedLinkFromUrl()` — the key is persisted separately, so a later
   refresh restores it from storage rather than re-applying a URL the viewer may
   have navigated away from.
4. A link that fails to decode is stripped anyway and falls back to the
   persisted key, so a bad link never strands the viewer.

**A match link and this component cannot coexist**, and an earlier draft of this
document assumed they could. Step 3 strips on mount, which §4 forbids for a match
link: nothing persists a match id, so stripping it before resolution completes
throws away the only copy. There is no ordering of the two that works — the
component's whole contract is that the URL is disposable the moment it is read.

So the root page does not render `PubkeyInput` in match-link mode at all. The
input is not on screen; the viewport is the match the link named. The strip in
step 3 is therefore always a board link's, which is what makes it safe.

That left `connectToPubkey` with two callers — the input, and the root page
resolving a link — so it moved out of the component into `src/lib/connect.ts`.
It is the same four steps it always was (`clearMatches`, `debugMode`,
`activePubkey`, `persistPubkey`, `subscribeToMatches`); only its home changed.

## 3. Resolution semantics

### 3.1 The hard part is waiting, not parsing

`src/routes/match/[id]/+page.svelte` reads its match out of the `matchesMap`
store. That store is filled by the board subscription (`subscribeToMatches` in
`src/lib/nostr.ts`, via `upsertMatch`). Nothing else fills it. So a **cold visit
finds nothing**: open `/match/abcd` in a fresh tab and the route renders its
not-found branch immediately, because no subscription has ever run.

Two consequences for a shared match link:

- **The id alone is not enough.** The subscription filter is keyed by
  `authors: [pubkeyHex]`; without the npub there is nobody to subscribe to.
  This is not only a subscription concern — see the lookup key below.
- **There is an unavoidable wait.** The pubkey is set, *then* the subscription
  opens, *then* events arrive from the relays some unknown time later. Rendering
  the match view the instant the link opens shows the recipient **"Match not
  found"** as the first thing they see — the precise opposite of what the link
  promised, on the happy path.

**The lookup key is (organizer, matchId), never matchId alone.** Normative, and
shared with the companion spec: a match resolves only if the event's author
equals the npub the link named. An event carrying the same id from a *different*
author must neither resolve the route nor expire it — it is somebody else's
match that happens to have collided in a 16-bit space (§1), and treating it as
this link's subject would show one organizer's fight to another organizer's
guests, or declare a live match over because an unrelated one aged out.

`matchesMap` in `src/lib/stores.ts` is still keyed by match id alone, which is
safe only because the board subscribes to exactly one author at a time and
`subscribeToMatches` closes the previous subscription before opening the next. A
match link makes the author an explicit part of what the URL names, so the
resolution path compares it rather than assuming it: `findMatchByOrganizer`
(`src/lib/stores.ts`) rejects a hit whose `pubkey` is not the organizer the link
named, and applies `isMatchFresh` in the same place so an expired match is
`undefined` for the same reason a missing one is.

Both readers of the store go through it — the root page for a shared link, and
the match route, which could have got away with the id and does not, because
"could get away with" is how the collision arrives. Coverage for **two different
authors publishing the same match id** is in `src/routes/page.test.ts` and
`src/lib/stores.test.ts`.

### 3.2 Four states, and the two nobody thinks to build

| State | Condition | What is shown |
|---|---|---|
| **Pending** | A match has been named; the feed has not answered yet | A waiting state that says so |
| **Resolved** | The event arrived and is fresh | The match view, as reached from the board today |
| **Unresolved** | The feed settled and this id is not in it | Say that plainly, mention it may have ended, keep the board reachable |
| **Broken** | The URL never named a match: the id failed the grammar, or there is no readable organizer (§1) | Say the *link* is unreadable and to ask the sender for another |

Pending and Broken are the two an implementation skips by accident. Pending
because the happy path is fast on a warm relay, so "not found" looks correct
right up until someone opens the link on a train; Broken because §1 defines it
and nothing forces you to give it words.

"The feed settles eventually" is not something two teams can implement the same
way twice, so the rules below are **normative** and shared with the companion
spec:

1. **The settled signal is NIP-01's `EOSE`.** It is the relay saying "that was
   everything I had stored"; nothing else means the same thing. **`EOSE` with no
   matching event ends Pending immediately** — there is no reason to keep a
   spinner up once the relays have said they have nothing, and doing so would
   make the fast, honest answer feel like the slow one.
2. **The backstop is 10 seconds after the link opens**, for the case where
   `EOSE` never comes. Pending ends on whichever arrives first, the settled
   signal or the backstop; neither alone is sufficient. Both readers use this same
   number, so two people opening the same link on different platforms wait the
   same length of time and reach the same screen. Ten is not arbitrary: this repo
   already waits exactly that long before giving up on EOSE
   (`src/lib/nostr.ts:302`), and inventing a second timeout a couple of seconds
   away from an existing one buys nothing while leaving two magic numbers where
   there was one.
3. **A late arrival still wins.** If the event turns up after the move to
   Unresolved — a slow relay, a reconnect — resolve to it and show the match.
   Unresolved states what is known so far; it is not a terminal state and must
   not tear down the subscription that could still answer.
4. **Unresolved never becomes the board on its own.** The viewer followed a link
   meant for one particular thing. Showing them a different thing that looks like
   it worked is a lie they cannot catch. The board stays one deliberate tap away,
   never a silent substitution.

**Rule 1 needed work in both readers, but not the same work.** In the Choke app,
`NostrRelayBackend` exposes only `Stream<NostrEvent> get events` — end-of-stored-
events is never carried across that boundary, so the signal does not reach Dart
at all and has to be plumbed through before anything can wait on it; that is
still owed there. Here the signal already arrived — `subscribeToMatches` in
`src/lib/nostr.ts` passes an `oneose` handler to `SimplePool.subscribeMany` — but
`oneose` only cleared the shared `isLoading` store, which the 10-second
`setTimeout` beneath it also clears. A caller watching `isLoading` cannot tell
"the relays answered" from "ten seconds passed", and gets whichever happened
first. Enough for a spinner over a list; not enough for rule 1.

So EOSE now has its own channel: `relaysSettled` in `src/lib/stores.ts`, set by
`oneose` and by nothing else. The timeout deliberately leaves it alone.
`subscribeToMatches` resets it to `false` on every subscription including a
watchdog rebuild, and `closeSubscription` clears it, so a stale `true` can never
let a link conclude the relays answered on a socket that is gone.

Two further traps in that same code, which the implementation had to route
around and the next person will meet again:

- **Matching the number is not the same as reusing the store.** The backstop of
  rule 2 is the same ten seconds `subscribeToMatches` already uses — one
  constant, `MATCH_LINK_BACKSTOP_MS` in `src/lib/constants.ts`, which both now
  read. But the waiting view owns its own timer. Deriving Pending from
  `isLoading` would make it end on whichever of EOSE-or-timeout fired first with
  no way to know which, and rule 3 needs that distinction: a resolve after EOSE
  means the relays genuinely do not have the event, while a resolve after the
  timeout means nobody answered yet and the late arrival is likely.
- The subscription outlives the backstop, which is what makes rule 3 work:
  events keep arriving through `onevent` → `upsertMatch` into `matchesMap`, so
  an Unresolved view that keeps reading the store resolves for free when the
  event lands. `src/routes/+page.svelte` re-derives `linkedMatch` from the store
  rather than snapshotting it, for exactly that reason.

**The copy is a first-class part of this, and the build order originally missed
half of it.** §6.3 asked only for Pending and Unresolved strings — because
`match.notFoundBody` (*"This match may not exist or hasn't been loaded yet"*) was
one string hedging across those two, and splitting it was the visible task.
Broken had no copy at all, which §1 forbids in principle and nothing caught in
practice. The four states now map to keys one for one:

| State | Title | Body |
|---|---|---|
| Pending | `match.pendingTitle` | `match.pendingBody` |
| Unresolved | `match.notFoundTitle` | `match.expiredBody` |
| Broken | `match.brokenTitle` | `match.brokenBody` |

`match.notFoundBody` is gone. `MatchView.svelte` maps a `MissingReason` to these
keys, so adding a state without adding its words does not compile — which is the
property that was missing.

**Broken's copy is normative in the same way the states are.** It must say the
*link* is unreadable and ask for a fresh one; it must not mention expiry, ending,
or the 24-hour window. The app reuses its existing broken-link screen rather than
translating these strings, which is fine — what has to match is the statement,
not the wording. A recipient told "this may have ended" about a URL that was
mangled in transit will go and ask the sender about a match that is still
running.

### 3.3 Decision: render in place, never redirect

**A shared match link resolves on the root page.** `src/routes/+page.svelte`
swaps its whole viewport for `MatchView` when `match` is set. It does not
navigate to `/match/<id>`.

This was carried as an open question for one draft too long. It was not open:
§4's strip-timing rules already answered it, and writing the implementation is
what made that obvious.

**A redirect is a strip by another name, and a worse one.** §4 says nothing is
stripped until resolution completes, and that a refresh while Pending re-applies
the whole link. Navigating to `/match/abcd` breaks both at once. The id survives
in the path; the organizer does not. So a refresh from there is a **cold visit**
— a route with nothing subscribed, which §3.1 shows answers immediately with its
not-found branch — and the recipient gets an instant dead end for a match that
was on its way to them. It also leaves nobody with anything to forward: the URL
that named the match is gone from the address bar the moment it resolves.

Rendering in place costs one thing: two callers for the match view. That was
paid by extracting `src/components/MatchView.svelte` out of the match route, so
one renderer serves both paths — the route a viewer reaches from the board, and
the root page holding a link. No markup is duplicated, and the extraction is why
the route's file is now thirty lines.

The component keeps the difference the two callers actually have, which is how a
viewer leaves. The route hands them a link to `/`; the root page cannot, because
the shared match view *is* `/` and an anchor there navigates nowhere. So the root
page passes an `onExit` callback instead and the board stays one deliberate tap
away. Never a silent substitution (rule 4 of §3.2).

Two smaller consequences worth naming, since neither is obvious from the
component:

- The link is read at component setup and not in `onMount`, because it decides
  what to render on the **first paint**. A match link that showed the board for
  a frame before swapping would be the silent substitution the design refuses,
  briefly.
- `src/routes/+layout.svelte` drops its header and footer for the broadcast
  view, and knew the match view by its route id. A shared link is not a route,
  so `sharedMatchView` (`src/lib/stores.ts`) is how the root page says the same
  thing.

The static SPA setup (`+layout.ts`: `ssr = false`, `prerender = true`;
`adapter-static` with `fallback: '404.html'`) would have supported either — a
deep path is served the fallback shell and routed client-side. It is not what
decided this.

## 4. Stripping, and a trap

A `match=` parameter left in the address bar after the pubkey has been stripped
produces exactly the broken link of §1: a match id with no author. Whatever
strips must strip both, or neither.

This was not hypothetical — it was happening on every bundle that predated the
fix (§1.2), which is why it was step 1 of §6.3 rather than a tidy-up at the end.
`stripSharedLinkFromUrl` (`src/lib/share-link.ts`) is what does it now, and it is
named for what it removes: the old `stripSharedPubkeyFromUrl` would have been a
lie about its own behaviour.

**When** to strip is as normative as **what**:

- **Nothing is stripped until resolution completes** — Resolved or Unresolved.
  Today `PubkeyInput.svelte` strips on mount (§2.2), which for a board link is
  fine because the key is persisted the moment it is read. A match link has no
  such fallback: stripping on mount throws away the id that a retry, a
  reconnect, or the late arrival of rule 3 (§3.2) still needs, and leaves the
  address bar holding `match` without `npub` — the broken form — for the entire
  time the viewer is waiting.
- **When it does happen, `npub` and `match` go together, or neither goes.** Half
  a link in the address bar is worse than the whole one.
- **A refresh while still Pending therefore re-applies the whole link**, which is
  the wanted behaviour: the viewer gets another attempt at the thing they were
  sent, not a board they did not ask for.

This also interacts with the routing question in §3.3 — if the implementation
redirects to `/match/<id>`, the shareable URL is gone from the address bar the
moment the link resolves, and a recipient who wants to forward it has nothing to
copy.

## 5. Lifetime of a match link

**Decision: a match link is live, not permanent.**

`MATCH_MAX_AGE_SECONDS` in `src/lib/constants.ts` is `86400`.

**That number is a conformance obligation, not a coincidence.** The Choke app
holds the same 86400 in `scoreboardMaxAgeSeconds`, and the value is normative in
both repos: neither side moves it without the other. Both readers measure the
same way — the event's `created_at` against the same boundary — so a given link
is Resolved in both readers or Unresolved in both, and never one of each. A
recipient who opens a link on the web and then on their phone must not see the
match in one and an expired notice in the other; that reads as one of the two
being broken, and neither is.

Each repo owes a test pinning its own constant to `86400`, so a silent drift
fails a build rather than surfacing as a support question months later.
**Neither repo has that test today.** Nothing under `src/` here asserts
`MATCH_MAX_AGE_SECONDS === 86400`, and the Choke app's tests reference
`scoreboardMaxAgeSeconds` relatively without ever pinning its value — so at
present the only thing holding the two numbers together is this paragraph and
its counterpart in the spec. It is a one-line addition owed on each side,
independently; neither is waiting on the other. Ours belongs with the match-link
work (§7).

Twenty-four hours is enforced twice on this side:

- `subscribeToMatches` sets `since = now - MATCH_MAX_AGE_SECONDS` on the filter
  and re-checks client-side, because relays may ignore `since`;
- `isMatchFresh` (`src/lib/stores.ts`) gates the match route itself, on a ticking
  clock, so a match open on screen expires where it stands.

Two enforcements is a *stricter* reading than the app's single check, and that is
allowed — what conformance requires is an identical boundary, not an identical
number of places it is applied. A match this repo hides is one the app would
also consider expired; the extra check only closes the gap where a relay ignores
`since` or where the clock crosses the boundary while the page is open.

So a shared match link resolves for a day and is Unresolved after that. This is
written down rather than discovered later, because it is a product choice:

- A live scoreboard is about the mats in front of you. A link that says "watch
  this now" is honest about being about now.
- Permanence is not a small change. It means fetching one event by its
  coordinates instead of reading the recent-matches window — a different query,
  a different cache, a different empty state.
- **Permanence is already a paid feature in the business plan** (permanent event
  archive). Giving away indefinite match permalinks for free spends that before
  it has been sold.

What this obliges: the Unresolved state must say the match **may have ended some
time ago**, not merely that it does not exist. A recipient opening yesterday's
link deserves to understand that the link was fine and the window closed —
otherwise it reads as the site being broken, and they blame the sender.

The match route already treats this dead end as the warmest visitor the app gets
and answers it with an install pitch (`cta.deadEndPitch`). That framing survives
match links unchanged; only the wording of *why* the match is gone has to become
specific.

Revisiting the 24-hour window is a deliberate follow-up, not a bug report.

## 6. Build order

### 6.1 Baseline already on `main`

This work does not start from nothing. It builds on top of:

- **The expired-match dead end** (`ab8f81e`, PR #33). The not-found branch of
  `src/routes/match/[id]/+page.svelte` already answers a match that aged out
  with an install pitch (`cta.deadEndPitch`) and a Play Store button
  (`cta.install`, `PLAY_STORE_URL`), with `match.backToScoreboard` demoted
  underneath. That page is the *existing* Unresolved state; §3.2 splits its copy
  rather than building a new screen.
- **The board-wall credit** (`7028a82`, PR #32): `cta.scoredWith` and
  `cta.getTheApp`, on the wall board and in the footer. This is why a resolved
  match link needs no invitation of its own — the wall already carries one.
- `MATCH_MAX_AGE_SECONDS` and `isMatchFresh`, which is what makes a match link
  expire (§5) instead of needing a lifetime rule invented for it.

### 6.2 Readers land before writers

**This is the ordering constraint that matters.** Both readers — this web board
and the Flutter app — must understand `match=` *before* anything starts
producing links that carry it.

The reason is not that early links are poisoned. They are not: the URL keeps
carrying `match=` wherever it travels, so the moment the readers ship, the very
same message resolves to the fight. And matches expire after 24 hours (§5), so
links from before the readers landed are largely moot by then anyway.

The reason is the window itself. While a share affordance stands alone, **every
reader in existence is an old reader**. Every recipient lands on a list instead
of the fight, every time — and the sender has no way to know, because the link
works perfectly on the device that produced it. A share button whose links
nobody can open is a broken feature for as long as it is alone, and the people
who find out are the organizer's guests. The backward compatibility of §1.2
makes that outcome **safe**, not **desirable**, and it is avoidable for free by
ordering the work.

So: parse first, resolve second, offer third.

This repo's reader should land alongside steps 1–2 of the app's sequence — its
URL parsing and its link handling — and before any share affordance ships in
either repo.

### 6.3 Sequence for this repo

| # | Step | Notes |
|---|---|---|
| 1 | Read `match=` out of the query string in `src/lib/share-link.ts`, and fix `stripSharedPubkeyFromUrl` to strip both params together or neither | Pure functions, no UI, no routing. The strip fix belongs here and not later: a resolved match link otherwise strands `?match=abcd` in the address bar, which is precisely the broken form §1 defines (§4). Extend `src/lib/share-link.test.ts`. |
| 2 | Route and resolve: settle redirect-to-`/match/[id]` vs render-in-place (§3.3), then implement Pending / Resolved / Unresolved (§3.2), keying the lookup by (organizer, matchId) (§3.1) and deferring the strip until resolution completes (§4) | The hard part, and the only step with real design left in it. §3.3 is a genuine open question, not a formality. |
| 3 | Split `match.notFoundBody` into distinct Pending and Unresolved strings in `src/lib/i18n/en.ts`, `es.ts` and `pt.ts` | One string currently hedges across both states — *"may not exist or hasn't been loaded yet"* — which is the exact ambiguity §3.2 exists to remove. All three catalogs, or it does not compile (§7). |

Step 1 is separable and can merge on its own; it changes no behaviour a viewer
can see.

**A share affordance on the web is not in scope.** The app is where sharing
happens — it is the device holding the match. This repo's job here is purely to
*receive*. `buildShareLink` stays what §2.1 says it is: a format definition the
tests round-trip, not a button.

## 7. Implementation notes

- **Strings.** Every new user-facing string goes in all three catalogs:
  `src/lib/i18n/en.ts`, `es.ts`, `pt.ts`. `defineCatalog` makes a missing key —
  or a message that dropped a parameter — a compile error, not a blank word on a
  wall. See [Languages](./i18n.md).
- **Ids stay ids.** A match id such as `abcd` is protocol, in the same way the
  status and method values `in-progress` and `armbar` are protocol. It is never
  translated and never prettified for display.
- **Tests.** `src/lib/share-link.test.ts` pins the query contract in both
  directions. Anything added to the contract in §1 belongs there too — including
  the `match` grammar and its parsing order: percent-encoded, whitespace-padded
  and upper-case forms must be shown to be *accepted*, and wrong length or
  non-hex characters to be *rejected*, not quietly passed through. That file is
  what stops this repo and the Choke app from drifting apart.
- **Cover the collision.** Two different authors publishing the same match id is
  the case the (organizer, matchId) lookup key exists for (§3.1). It has no
  coverage today because nothing yet resolves a match by author; it is owed with
  the change that does.
- **Pin the window.** Add an assertion that `MATCH_MAX_AGE_SECONDS` is `86400`
  (§5). It looks like a test of a literal against itself; it is not. It is this
  repo's half of a cross-repo agreement, and its only job is to fail the build
  when someone changes the window here without changing it there.
