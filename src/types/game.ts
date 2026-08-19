import type {Verb, VerbForm} from './verb'

export const GAME_MODES = ['target', 'precision'] as const

export type GameMode = (typeof GAME_MODES)[number]

export const PRACTICE_MODE = 'practice'

export const MENU_MODES = [...GAME_MODES, PRACTICE_MODE] as const

export type MenuMode = (typeof MENU_MODES)[number]

export function isGameMode(value: unknown): value is GameMode {
	return typeof value === 'string' && GAME_MODES.some((mode) => mode === value)
}

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

export type Difficulty = (typeof DIFFICULTIES)[number]

export function isDifficulty(value: unknown): value is Difficulty {
	return typeof value === 'string' && DIFFICULTIES.some((difficulty) => difficulty === value)
}

export type CellId = string

export interface Cell {
	readonly id: CellId
	readonly verbId: number
	readonly form: VerbForm
	readonly text: string
	readonly meaning: string | null
}

export type CellStatus = 'neutral' | 'selected' | 'resolved' | 'error'

export type Selection = Record<VerbForm, CellId | null>

export type Columns = Record<VerbForm, Cell[]>

export interface BoardState {
	columns: Columns
	selection: Selection
	resolvedVerbIds: number[]
	errorCellIds: CellId[]
	pool: Verb[]
}

export type SelectionOutcome =
	| {readonly type: 'ignored'}
	| {readonly type: 'selected'}
	| {readonly type: 'deselected'}
	| {readonly type: 'match'; readonly verbId: number; readonly cellIds: readonly CellId[]}
	| {readonly type: 'mismatch'; readonly cellIds: readonly CellId[]}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost'

export type FinishedStatus = Extract<GameStatus, 'won' | 'lost'>

export interface SessionResult {
	readonly mode: GameMode
	readonly difficulty: Difficulty
	readonly status: FinishedStatus
	readonly timeMs: number
	readonly errors: number
	readonly verbsMatched: number
	readonly completedAt: string
}
