import type {Difficulty} from '@/types/game'
import type {VerbLevel} from '@/types/verb'

export interface LevelConfig {
	readonly id: Difficulty
	readonly label: string
	readonly verbLevels: readonly VerbLevel[]
	readonly boardSize: number
	readonly targetVerbs: number
	readonly timeLimitMs: number
	readonly refillDelayMs: number
	readonly refillMinVacancies: number
	readonly refillForceVacancies: number
	readonly refillGraceMs: number
	readonly errorPenaltyMs: number
}

const SECOND = 1000

export const LEVELS = Object.freeze({
	easy: Object.freeze({
		id: 'easy',
		label: 'Fácil',
		verbLevels: Object.freeze(['beginner'] as const),
		boardSize: 6,
		refillMinVacancies: 3,
		refillForceVacancies: 5,
		targetVerbs: 16,
		timeLimitMs: 90 * SECOND,
		refillDelayMs: 5 * SECOND,
		refillGraceMs: 5 * SECOND,
		errorPenaltyMs: 2 * SECOND,
	}),
	medium: Object.freeze({
		id: 'medium',
		label: 'Medio',
		verbLevels: Object.freeze(['beginner', 'intermediate'] as const),
		boardSize: 8,
		refillMinVacancies: 3,
		refillForceVacancies: 7,
		targetVerbs: 20,
		timeLimitMs: 90 * SECOND,
		refillDelayMs: 5 * SECOND,
		refillGraceMs: 5 * SECOND,
		errorPenaltyMs: 2 * SECOND,
	}),
	hard: Object.freeze({
		id: 'hard',
		label: 'Difícil',
		verbLevels: Object.freeze(['intermediate', 'advanced'] as const),
		boardSize: 8,
		refillMinVacancies: 3,
		refillForceVacancies: 7,
		targetVerbs: 24,
		timeLimitMs: 100 * SECOND,
		refillDelayMs: 5 * SECOND,
		refillGraceMs: 5 * SECOND,
		errorPenaltyMs: 3 * SECOND,
	}),
}) satisfies Readonly<Record<Difficulty, LevelConfig>>

export const MIN_MATCHES_FOR_RANKING = 5

export const MASTERY_MIN_CORRECT = 3
export const MASTERY_MIN_ACCURACY = 0.8

export function getLevelConfig(difficulty: Difficulty): LevelConfig {
	return LEVELS[difficulty]
}
