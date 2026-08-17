/**
 * Tipos del estado de juego.
 *
 * Principio aplicado (skill `vue-best-practices`): el estado fuente se mantiene
 * mínimo y todo lo demás se deriva. Por eso una `Cell` es dato inmutable y NO
 * guarda su estado visual: si una celda está seleccionada, resuelta o en error
 * se deduce de `selection`, `resolvedVerbIds` y `errorCellIds` en `BoardState`.
 * Guardar el estado en la celda crearía una segunda fuente de verdad que habría
 * que mantener sincronizada a mano.
 */

import type {Verb, VerbForm} from './verb'

/** Modos con ranking. El modo Práctica no usa el tablero (`MECHANICS.md` §4). */
export const GAME_MODES = ['target', 'precision'] as const

export type GameMode = (typeof GAME_MODES)[number]

/** Niveles de dificultad configurables en `data/levels.ts` (T0.7). */
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

export type Difficulty = (typeof DIFFICULTIES)[number]

/**
 * Identificador estable de celda, con formato `${verbId}:${form}`.
 *
 * Sirve como `:key` en el renderizado y como referencia en la selección. Es
 * estable entre re-renders, a diferencia del índice de posición, que cambia
 * cuando se repone una tríada (`MECHANICS.md` §1).
 */
export type CellId = string

/**
 * Una celda del tablero: dato inmutable, sin estado visual.
 *
 * `text` se guarda ya resuelto en vez de derivarlo del verbo en cada render,
 * porque el contenido de una celda nunca cambia durante la partida.
 */
export interface Cell {
	readonly id: CellId
	readonly verbId: number
	readonly form: VerbForm
	readonly text: string
}

/**
 * Estado visual de una celda. Es un valor **derivado**, no almacenado:
 * se calcula a partir de `BoardState`. Cada variante se corresponde con una
 * utilidad `cell-*` de `assets/main.css`.
 */
export type CellStatus = 'neutral' | 'selected' | 'resolved' | 'error'

/** Celda elegida en cada columna, o `null` si esa columna no tiene selección. */
export type Selection = Record<VerbForm, CellId | null>

/** Las tres columnas del tablero, una por forma verbal. */
export type Columns = Record<VerbForm, Cell[]>

export interface BoardState {
	columns: Columns
	selection: Selection
	/** Verbos ya emparejados. Sus 3 celdas se muestran como resueltas. */
	resolvedVerbIds: number[]
	/** Celdas del último intento fallido. Transitorio: se limpia tras el feedback. */
	errorCellIds: CellId[]
	/**
	 * Verbos del nivel aún no mostrados. Alimentan la reposición de tríadas
	 * (`PLAN.md`, Bitácora, P1). Cuando se vacía, el tablero se reduce.
	 */
	pool: Verb[]
}

/**
 * Qué ocurrió al pulsar una celda.
 *
 * El tablero no sabe de puntaje, tiempo ni fin de ronda: devuelve lo que pasó y
 * el motor de juego (Fase 2) decide las consecuencias, que son distintas en cada
 * modo — en Objetivo un fallo sólo penaliza tiempo, en Precisión termina la
 * partida (`MECHANICS.md` §2 y §3).
 */
export type SelectionOutcome =
	/** La celda no era seleccionable (su verbo ya estaba resuelto). */
	| {readonly type: 'ignored'}
	/** Selección registrada; la tríada aún está incompleta. */
	| {readonly type: 'selected'}
	/** Se pulsó la celda ya seleccionada de esa columna y se retiró la selección. */
	| {readonly type: 'deselected'}
	/** Tríada correcta. `cellIds` son las celdas que salen del tablero. */
	| {readonly type: 'match'; readonly verbId: number; readonly cellIds: readonly CellId[]}
	/** Tríada incorrecta. `cellIds` son las celdas que deben mostrar el error. */
	| {readonly type: 'mismatch'; readonly cellIds: readonly CellId[]}

/**
 * Estado de la partida.
 *
 * `won` y `lost` son terminales; sólo desde ellos se construye un
 * `SessionResult`.
 */
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost'

/** Estado terminal de una partida. */
export type FinishedStatus = Extract<GameStatus, 'won' | 'lost'>

/**
 * Resultado de una partida terminada.
 *
 * Es la forma que se muestra en pantalla y, para usuarios autenticados, la que
 * se persiste en `game_sessions` (Fase 5). El **ritmo** del Modo Precisión no
 * se almacena: se calcula desde `verbsMatched` y `timeMs` (`MECHANICS.md` §6).
 */
export interface SessionResult {
	readonly mode: GameMode
	readonly difficulty: Difficulty
	readonly status: FinishedStatus
	/** Duración de la partida en milisegundos. Siempre mayor que 0. */
	readonly timeMs: number
	/** En Modo Precisión siempre es 0: el primer error termina la ronda. */
	readonly errors: number
	readonly verbsMatched: number
	/** Marca de tiempo en formato ISO 8601. */
	readonly completedAt: string
}
