import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {isRef} from 'vue'
import {useGameEngine} from '../useGameEngine'
import {REFILL_APPEAR_MS, useGameStore} from '@/stores/game'
import {getLevelConfig} from '@/data/levels'
import {VERB_FORMS, type VerbForm} from '@/types/verb'
import type {Cell} from '@/types/game'

const SECOND = 1000

beforeEach(() => {
	setActivePinia(createPinia())
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

type Engine = ReturnType<typeof useGameEngine>

function cellOf(engine: Engine, verbId: number, form: VerbForm): Cell {
	const cell = engine.columns.value[form].find((candidate) => candidate.verbId === verbId)
	if (cell === undefined) throw new Error(`El verbo ${verbId} no está en la columna ${form}`)
	return cell
}

function visibleVerbIds(engine: Engine): number[] {
	return engine.columns.value.present
		.filter((cell) => !engine.resolvedVerbIds.value.includes(cell.verbId))
		.map((cell) => cell.verbId)
}

function solve(engine: Engine, verbId: number): void {
	for (const form of VERB_FORMS) engine.selectCell(cellOf(engine, verbId, form))
}

function fail(engine: Engine): void {
	const [first, second] = visibleVerbIds(engine)
	engine.selectCell(cellOf(engine, first ?? 0, 'present'))
	engine.selectCell(cellOf(engine, first ?? 0, 'past'))
	engine.selectCell(cellOf(engine, second ?? 0, 'participle'))
}

describe('useGameEngine — contrato de reactividad', () => {
	it('expone el estado como refs, no como valores sueltos', () => {
		const engine = useGameEngine()
		const stateKeys = [
			'status',
			'columns',
			'matchedCount',
			'errors',
			'elapsedMs',
			'isPlaying',
			'result',
		] as const

		expect(stateKeys.every((key) => isRef(engine[key]))).toBe(true)
	})

	it('expone las acciones como funciones', () => {
		const engine = useGameEngine()
		const actionKeys = ['startGame', 'selectCell', 'finish', 'clearError', 'resetGame'] as const

		expect(actionKeys.every((key) => typeof engine[key] === 'function')).toBe(true)
	})

	it('el estado se actualiza al ejecutar acciones', () => {
		const engine = useGameEngine()

		expect(engine.status.value).toBe('idle')
		engine.startGame('target', 'easy')

		expect(engine.status.value).toBe('playing')
		expect(engine.visibleCount.value).toBe(getLevelConfig('easy').boardSize)
	})

	it('el reloj se refleja en la interfaz', () => {
		const engine = useGameEngine()
		engine.startGame('target', 'easy')

		vi.advanceTimersByTime(5 * SECOND)

		expect(engine.elapsedMs.value).toBe(5 * SECOND)
		expect(engine.remainingMs.value).toBe(getLevelConfig('easy').timeLimitMs - 5 * SECOND)
	})

	it('dos instancias comparten la misma partida', () => {
		const first = useGameEngine()
		const second = useGameEngine()

		first.startGame('precision', 'medium')
		solve(second, visibleVerbIds(second)[0] ?? 0)

		expect(second.status.value).toBe('playing')
		expect(first.matchedCount.value).toBe(1)
		expect(second.matchedCount.value).toBe(1)
	})

	it('refleja los cambios hechos directamente sobre el store', () => {
		const store = useGameStore()
		const engine = useGameEngine()

		store.startGame('target', 'hard')

		expect(engine.mode.value).toBe('target')
		expect(engine.difficulty.value).toBe('hard')
		expect(engine.level.value?.boardSize).toBe(getLevelConfig('hard').boardSize)
	})
})

describe('useGameEngine — estado visual de celdas', () => {
	it('una celda sin tocar es neutra', () => {
		const engine = useGameEngine()
		engine.startGame('target', 'easy')
		const cell = cellOf(engine, visibleVerbIds(engine)[0] ?? 0, 'present')

		expect(engine.cellStatus(cell)).toBe('neutral')
	})

	it('marca como seleccionada la celda elegida', () => {
		const engine = useGameEngine()
		engine.startGame('target', 'easy')
		const cell = cellOf(engine, visibleVerbIds(engine)[0] ?? 0, 'present')

		engine.selectCell(cell)

		expect(engine.cellStatus(cell)).toBe('selected')
	})

	it('marca en error las celdas de un intento fallido', () => {
		const engine = useGameEngine()
		engine.startGame('target', 'easy')
		const [first, second] = visibleVerbIds(engine)
		const cells = [
			cellOf(engine, first ?? 0, 'present'),
			cellOf(engine, first ?? 0, 'past'),
			cellOf(engine, second ?? 0, 'participle'),
		]

		for (const cell of cells) engine.selectCell(cell)

		expect(cells.every((cell) => engine.cellStatus(cell) === 'error')).toBe(true)
	})

	it('`clearError` devuelve las celdas a neutro', () => {
		const engine = useGameEngine()
		engine.startGame('target', 'easy')
		const cell = cellOf(engine, visibleVerbIds(engine)[0] ?? 0, 'present')
		fail(engine)

		engine.clearError()

		expect(engine.cellStatus(cell)).toBe('neutral')
	})
})

describe('useGameEngine — celdas pulsables', () => {
	it('las celdas del tablero son pulsables durante la partida', () => {
		const engine = useGameEngine()
		engine.startGame('target', 'easy')
		const cell = cellOf(engine, visibleVerbIds(engine)[0] ?? 0, 'past')

		expect(engine.isCellSelectable(cell)).toBe(true)
	})

	it('el tablero es inerte antes de arrancar', () => {
		const engine = useGameEngine()
		const cell: Cell = {id: '1:present', verbId: 1, form: 'present', text: 'be', meaning: 'ser'}

		expect(engine.isCellSelectable(cell)).toBe(false)
	})

	it('el tablero es inerte tras terminar', () => {
		const engine = useGameEngine()
		engine.startGame('precision', 'easy')
		const cell = cellOf(engine, visibleVerbIds(engine)[0] ?? 0, 'present')

		fail(engine)

		expect(engine.isCellSelectable(cell)).toBe(false)
	})
})

describe('useGameEngine — partida completa', () => {
	it('juega un Modo Objetivo hasta la victoria', () => {
		const engine = useGameEngine()
		const {targetVerbs} = getLevelConfig('easy')
		engine.startGame('target', 'easy')
		vi.advanceTimersByTime(20 * SECOND)

		for (let done = 0; done < targetVerbs; done++) {
			if (visibleVerbIds(engine).length === 0) {
				vi.advanceTimersByTime(getLevelConfig('easy').refillDelayMs + REFILL_APPEAR_MS)
			}

			solve(engine, visibleVerbIds(engine)[0] ?? 0)
		}

		expect(engine.status.value).toBe('won')
		expect(engine.isFinished.value).toBe(true)
		expect(engine.remainingTargets.value).toBe(0)
		expect(engine.result.value).toMatchObject({mode: 'target', status: 'won', errors: 0})
		expect(engine.isRankingEligible.value).toBe(true)
	})

	it('juega un Modo Supervivencia hasta el primer fallo', () => {
		const engine = useGameEngine()
		engine.startGame('precision', 'easy')
		for (let done = 0; done < 6; done++) {
			solve(engine, visibleVerbIds(engine)[0] ?? 0)
			vi.advanceTimersByTime(getLevelConfig('easy').refillDelayMs)
		}
		expect(engine.elapsedMs.value).toBe(30 * SECOND)

		fail(engine)

		expect(engine.status.value).toBe('lost')
		expect(engine.matchedCount.value).toBe(6)
		expect(engine.errors.value).toBe(0)
		expect(engine.pace.value).toBe(12)
		expect(engine.isRankingEligible.value).toBe(true)
	})

	it('`resetGame` deja todo listo para volver a empezar', () => {
		const engine = useGameEngine()
		engine.startGame('target', 'easy')
		solve(engine, visibleVerbIds(engine)[0] ?? 0)
		engine.finish('won')

		engine.resetGame()

		expect(engine.status.value).toBe('idle')
		expect(engine.matchedCount.value).toBe(0)
		expect(engine.result.value).toBeNull()
		expect(engine.visibleCount.value).toBe(0)
	})
})
