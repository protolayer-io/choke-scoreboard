import { defineCatalog } from './index.js';
import { plural } from './plural.js';

/**
 * Português (pt-BR).
 *
 * The language the sport is argued in — which raises the question this catalog
 * had to answer and the Spanish one could dodge: `armbar` is *chave de braço*
 * here, and the rest of the world learned to say `armbar` from Brazilians who
 * say *chave de braço*. So they are translated, all of them. A Brazilian gym
 * reading `Armbar` off the wall would be the tell that nobody thought about who
 * is actually in the room.
 *
 * `heel_hook` and `toe_hold` stay in English, as they are said on the mat.
 */
export const pt = defineCatalog({
	// ─── Chrome ─────────────────────────────────────────────────────────────
	'app.name': 'Choke Scoreboard',
	'app.description': 'Placar de jiu-jítsu brasileiro em tempo real via Nostr',
	'header.toggleTheme': 'Alternar tema',
	'header.selectLanguage': 'Idioma',
	'language.en': 'English',
	'language.es': 'Español',
	'language.pt': 'Português',
	'footer.tagline': 'Placar de BJJ em tempo real via',

	// ─── Conexão com o organizador ──────────────────────────────────────────
	'pubkey.placeholder': 'Digite a npub ou chave pública hex do organizador...',
	'pubkey.load': 'Carregar',
	'pubkey.debugMode': '🐛 Modo debug',
	'pubkey.connected': 'Conectado',
	'pubkey.disconnect': 'Desconectar',
	'pubkey.error.invalidNpub': 'Formato de npub inválido',
	'pubkey.error.invalidPubkey': 'Chave pública inválida: precisa ser npub ou hex de 64 caracteres',

	// ─── Lista de lutas ─────────────────────────────────────────────────────
	'home.matchCount': (count: number) =>
		plural('pt', count, {
			one: `${count} luta`,
			other: `${count} lutas`
		}),
	'home.viewBroadcast': '📺 Transmissão',
	'home.viewCompact': '📋 Compacta',
	'home.connecting': 'Conectando aos relays...',
	'home.emptyTitle': 'Nenhuma luta encontrada',
	'home.emptyBody': 'Aguardando eventos de luta do organizador...',
	'home.welcomeTitle': 'Placar de lutas de BJJ',
	'home.welcomeBody':
		'Digite a chave pública Nostr de um organizador para acompanhar as lutas ao vivo, ou use o modo debug para ver lutas de exemplo.',

	// ─── Estado da luta ─────────────────────────────────────────────────────
	'status.waiting': 'AGUARDANDO',
	'status.live': 'AO VIVO',
	'status.paused': 'PAUSADA',
	'status.finished': 'ENCERRADA',
	'status.final': 'FINAL',
	'status.canceled': 'CANCELADA',

	// ─── O placar ───────────────────────────────────────────────────────────
	'score.vs': 'VS',
	'score.time': 'TEMPO',
	'score.points': 'Pontos',
	'score.result': 'RESULTADO',
	'score.winner': 'VENCEDOR',

	// Abreviações: lidas do outro lado do ginásio, então continuam curtas.
	'score.advantageShort': 'V',
	'score.penaltyShort': 'P',
	'score.advantages': 'VANT',
	'score.penalties': 'PUN',

	'score.pt2.card': '2pt:',
	'score.pt3.card': '3pt:',
	'score.pt4.card': '4pt:',
	'score.pt2.wall': '2 PTS',
	'score.pt3.wall': '3 PTS',
	'score.pt4.wall': '4 PTS',

	// ─── Transmissão ────────────────────────────────────────────────────────
	'match.back': 'Voltar',
	'match.fullscreen': 'Tela cheia',
	'match.exitFullscreen': 'Sair da tela cheia',
	'match.notFoundTitle': 'Luta não encontrada',
	'match.notFoundBody': 'Pode ser que esta luta não exista ou ainda não tenha sido carregada.',
	'match.backToScoreboard': 'Voltar ao placar',

	// ─── Como a luta foi vencida ────────────────────────────────────────────
	'method.submission': 'FINALIZAÇÃO',
	'method.points': 'PONTOS',
	'method.advantages': 'VANTAGEM',
	'method.decision': 'DECISÃO',
	'method.dq': 'DESCLASSIFICAÇÃO',
	'method.forfeit': 'W.O.',
	'method.draw': 'EMPATE',

	'submission.armbar': 'Chave de braço',
	'submission.rear_naked_choke': 'Mata-leão',
	'submission.triangle': 'Triângulo',
	'submission.guillotine': 'Guilhotina',
	'submission.kimura': 'Kimura',
	'submission.americana': 'Americana',
	'submission.cross_collar_choke': 'Gravata cruzada',
	'submission.bow_and_arrow': 'Estrangulamento arco e flecha',
	'submission.ezekiel': 'Ezequiel',
	'submission.omoplata': 'Omoplata',
	'submission.arm_triangle': 'Triângulo de braço',
	'submission.north_south_choke': 'Estrangulamento norte–sul',
	'submission.straight_ankle_lock': 'Chave de pé reta',
	'submission.heel_hook': 'Heel hook',
	'submission.toe_hold': 'Toe hold',

	'dq.accumulated_penalties': 'quatro punições',
	'dq.technical_foul': 'falta técnica',
	'dq.disciplinary_foul': 'falta disciplinar',

	'outcome.score': (top: number, bottom: number) => `${top} × ${bottom}`,
	'outcome.tied': (top: number, bottom: number) => `Empate ${top} × ${bottom}`,
	'outcome.tiedAdvantages': (top: number, bottom: number) =>
		`Empate ${top} × ${bottom} — decidido nas vantagens`,
	'outcome.tiedDecision': (top: number, bottom: number) =>
		`Empate ${top} × ${bottom} — decisão dos árbitros`,
	'outcome.submitted': 'Por finalização',
	'outcome.disqualified': 'desclassificado',
	'outcome.forfeit': 'O adversário desistiu',
	'outcome.dqDetail': (reason: string, detail: string) => `${reason} — ${detail}`,

	// ─── Erros ──────────────────────────────────────────────────────────────
	'error.pageNotFound': 'Página não encontrada',
	'error.somethingWrong': 'Algo deu errado',
	'error.backToScoreboard': 'Voltar ao placar',

	// ─── Títulos ────────────────────────────────────────────────────────────
	'title.home': '🥋 Choke Scoreboard',
	'title.match': (f1: string, f2: string) => `${f1} vs ${f2} — Choke Scoreboard`,
	'title.matchFallback': 'Luta — Choke Scoreboard'
});
