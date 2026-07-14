import { plural } from './plural.js';

/**
 * English. The source catalog: every other language is typed against this one,
 * so a locale that forgets a key does not compile.
 *
 * The keys are ids and never leave the app. THEY ARE NOT WIRE VALUES — the
 * match statuses, method ids, submission ids and dq reasons that travel over
 * Nostr live in types.ts and must never be translated (see the note above
 * SUBMISSION_LABELS in scoring.ts: `rear_naked_choke` on a wall is a bug, and a
 * relay receiving `chave de braço` is the same bug pointing the other way).
 *
 * A message that carries a value is a function, so the translator owns the word
 * order: a language that puts the count after the noun, or the loser before the
 * winner, can. Gluing values on with `+` outside the catalog takes that away.
 */
export const en = {
	// ─── App chrome ─────────────────────────────────────────────────────────
	'app.name': 'Choke Scoreboard',
	'app.description': 'Real-time Brazilian Jiu-Jitsu scoring via Nostr',
	'header.toggleTheme': 'Toggle theme',
	'footer.tagline': 'Real-time BJJ scoring via',

	// ─── Connecting to an organizer ─────────────────────────────────────────
	'pubkey.placeholder': 'Enter organizer npub or hex pubkey...',
	'pubkey.load': 'Load',
	'pubkey.debugMode': '🐛 Debug Mode',
	'pubkey.connected': 'Connected',
	'pubkey.disconnect': 'Disconnect',

	// The two ways a pubkey can be wrong. nostr.ts throws these as codes rather
	// than sentences: a library that throws English cannot be translated.
	'pubkey.error.invalidNpub': 'Invalid npub format',
	'pubkey.error.invalidPubkey': 'Invalid pubkey: must be npub or 64-char hex',

	// ─── The match list ─────────────────────────────────────────────────────
	'home.matchCount': (count: number) =>
		plural('en', count, {
			one: `${count} match`,
			other: `${count} matches`
		}),
	'home.viewBroadcast': '📺 Broadcast',
	'home.viewCompact': '📋 Compact',
	'home.connecting': 'Connecting to relays...',
	'home.emptyTitle': 'No matches found',
	'home.emptyBody': 'Waiting for match events from the organizer...',
	'home.welcomeTitle': 'BJJ Match Scoreboard',
	'home.welcomeBody':
		"Enter a tournament organizer's Nostr public key to subscribe to live match scores, or try Debug Mode to see example matches.",

	// ─── Match status ───────────────────────────────────────────────────────
	//
	// `finished` is FINISHED on a card and FINAL on the broadcast wall — the wall
	// has one line to say it in, and says it shorter. Two keys, on purpose.
	'status.waiting': 'WAITING',
	'status.live': 'LIVE',
	'status.paused': 'PAUSED',
	'status.finished': 'FINISHED',
	'status.final': 'FINAL',
	'status.canceled': 'CANCELED',

	// ─── The scoreboard itself ──────────────────────────────────────────────
	'score.vs': 'VS',
	'score.time': 'TIME',
	'score.points': 'Points',
	'score.result': 'RESULT',
	'score.winner': 'WINNER',

	// Abbreviations, and they have to stay short: they sit next to a number on a
	// wall read from across a gym. A translator who needs a longer word should
	// say so — what breaks then is the layout, not the meaning.
	'score.advantageShort': 'A',
	'score.penaltyShort': 'P',
	'score.advantages': 'ADV',
	'score.penalties': 'PEN',

	// The point breakdown, twice: lowercase on a card, uppercase on the wall.
	'score.pt2.card': '2pt:',
	'score.pt3.card': '3pt:',
	'score.pt4.card': '4pt:',
	'score.pt2.wall': '2 PTS',
	'score.pt3.wall': '3 PTS',
	'score.pt4.wall': '4 PTS',

	// ─── The broadcast view ─────────────────────────────────────────────────
	'match.back': 'Back',
	'match.fullscreen': 'Fullscreen',
	'match.exitFullscreen': 'Exit fullscreen',
	'match.notFoundTitle': 'Match not found',
	'match.notFoundBody': "This match may not exist or hasn't been loaded yet.",
	'match.backToScoreboard': 'Back to scoreboard',

	// ─── Errors ─────────────────────────────────────────────────────────────
	'error.pageNotFound': 'Page not found',
	'error.backToScoreboard': 'Back to Scoreboard',

	// ─── Page titles ────────────────────────────────────────────────────────
	'title.home': '🥋 Choke Scoreboard',
	'title.match': (f1: string, f2: string) => `${f1} vs ${f2} — Choke Scoreboard`,
	'title.matchFallback': 'Match — Choke Scoreboard'
} as const;
