import { defineCatalog } from './index.js';
import { plural } from './plural.js';

/**
 * Español.
 *
 * Typed as `Catalog`, so this file cannot forget a key, cannot drop the count
 * out of a plural, and cannot lose a fighter from a match title: it stops
 * compiling. That is the only reason a second language is safe to add at all.
 */
export const es = defineCatalog({
	// ─── Chrome ─────────────────────────────────────────────────────────────
	'app.name': 'Choke Scoreboard',
	'app.description': 'Puntuación de jiu-jitsu brasileño en tiempo real vía Nostr',
	'header.toggleTheme': 'Cambiar tema',
	'header.selectLanguage': 'Idioma',
	'language.en': 'English',
	'language.es': 'Español',
	'language.pt': 'Português',
	'footer.tagline': 'Puntuación de BJJ en tiempo real vía',

	// ─── Conexión con el organizador ────────────────────────────────────────
	'pubkey.placeholder': 'Ingresá la npub o clave pública hex del organizador...',
	'pubkey.load': 'Cargar',
	'pubkey.debugMode': '🐛 Modo debug',
	'pubkey.connected': 'Conectado',
	'pubkey.disconnect': 'Desconectar',
	'pubkey.error.invalidNpub': 'Formato de npub inválido',
	'pubkey.error.invalidPubkey': 'Clave pública inválida: debe ser npub o hex de 64 caracteres',

	// ─── Listado de luchas ──────────────────────────────────────────────────
	'home.matchCount': (count: number) =>
		plural('es', count, {
			one: `${count} lucha`,
			other: `${count} luchas`
		}),
	'home.viewBroadcast': '📺 Transmisión',
	'home.viewCompact': '📋 Compacta',
	'home.connecting': 'Conectando a los relays...',
	'home.emptyTitle': 'No hay luchas',
	'home.emptyBody': 'Esperando eventos de lucha del organizador...',
	'home.welcomeTitle': 'Tablero de luchas de BJJ',
	'home.welcomeBody':
		'Ingresá la clave pública Nostr de un organizador para seguir las luchas en vivo, o probá el modo debug para ver luchas de ejemplo.',

	// ─── Estado de la lucha ─────────────────────────────────────────────────
	'status.waiting': 'EN ESPERA',
	'status.live': 'EN VIVO',
	'status.paused': 'EN PAUSA',
	'status.finished': 'FINALIZADA',
	'status.final': 'FINAL',
	'status.canceled': 'CANCELADA',

	// ─── El tablero ─────────────────────────────────────────────────────────
	'score.vs': 'VS',
	'score.time': 'TIEMPO',
	'score.points': 'Puntos',
	'score.result': 'RESULTADO',
	'score.winner': 'GANADOR',

	// Abreviaturas: se leen desde el otro lado del gimnasio, así que son cortas a
	// propósito. V de ventaja, P de penalización.
	'score.advantageShort': 'V',
	'score.penaltyShort': 'P',
	'score.advantages': 'VENT',
	'score.penalties': 'PEN',

	'score.pt2.card': '2pt:',
	'score.pt3.card': '3pt:',
	'score.pt4.card': '4pt:',
	'score.pt2.wall': '2 PTS',
	'score.pt3.wall': '3 PTS',
	'score.pt4.wall': '4 PTS',

	// ─── Vista de transmisión ───────────────────────────────────────────────
	'match.back': 'Volver',
	'match.fullscreen': 'Pantalla completa',
	'match.exitFullscreen': 'Salir de pantalla completa',
	'match.notFoundTitle': 'Lucha no encontrada',
	'match.notFoundBody': 'Puede que esta lucha no exista o que todavía no se haya cargado.',
	'match.backToScoreboard': 'Volver al tablero',

	// ─── Cómo se ganó la lucha ──────────────────────────────────────────────
	'method.submission': 'SUMISIÓN',
	'method.points': 'PUNTOS',
	'method.advantages': 'VENTAJA',
	'method.decision': 'DECISIÓN',
	'method.dq': 'DESCALIFICACIÓN',
	'method.forfeit': 'ABANDONO',
	'method.draw': 'EMPATE',

	// Las sumisiones. `heel_hook` y `toe_hold` quedan en inglés porque así se
	// dicen en el tatami: traducirlas se leería más raro que dejarlas. Los ids del
	// cable no cambian nunca — solo cambia lo que se lee en la pared.
	'submission.armbar': 'Llave de brazo',
	'submission.rear_naked_choke': 'Mataleón',
	'submission.triangle': 'Triángulo',
	'submission.guillotine': 'Guillotina',
	'submission.kimura': 'Kimura',
	'submission.americana': 'Americana',
	'submission.cross_collar_choke': 'Estrangulación cruzada',
	'submission.bow_and_arrow': 'Estrangulación arco y flecha',
	'submission.ezekiel': 'Ezequiel',
	'submission.omoplata': 'Omoplata',
	'submission.arm_triangle': 'Triángulo de brazo',
	'submission.north_south_choke': 'Estrangulación norte–sur',
	'submission.straight_ankle_lock': 'Llave recta de tobillo',
	'submission.heel_hook': 'Heel hook',
	'submission.toe_hold': 'Americana de pie',

	'dq.accumulated_penalties': 'cuatro penalizaciones',
	'dq.technical_foul': 'falta técnica',
	'dq.disciplinary_foul': 'falta disciplinaria',

	'outcome.score': (top: number, bottom: number) => `${top} × ${bottom}`,
	'outcome.tied': (top: number, bottom: number) => `Empate ${top} × ${bottom}`,
	'outcome.tiedAdvantages': (top: number, bottom: number) =>
		`Empate ${top} × ${bottom} — definido por ventajas`,
	'outcome.tiedDecision': (top: number, bottom: number) =>
		`Empate ${top} × ${bottom} — decisión arbitral`,
	'outcome.submitted': 'Por sumisión',
	'outcome.disqualified': 'descalificado',
	'outcome.forfeit': 'El rival abandonó',
	'outcome.dqDetail': (reason: string, detail: string) => `${reason} — ${detail}`,

	// ─── Errores ────────────────────────────────────────────────────────────
	'error.pageNotFound': 'Página no encontrada',
	'error.somethingWrong': 'Algo salió mal',
	'error.backToScoreboard': 'Volver al tablero',

	// ─── Títulos ────────────────────────────────────────────────────────────
	'title.home': '🥋 Choke Scoreboard',
	'title.match': (f1: string, f2: string) => `${f1} vs ${f2} — Choke Scoreboard`,
	'title.matchFallback': 'Lucha — Choke Scoreboard'
});
