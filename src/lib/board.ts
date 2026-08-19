import type {Cell, CellId, CellStatus, Columns, Selection} from '@/types/game'
import type {Verb, VerbForm} from '@/types/verb'
import {shuffle, type Rng} from './shuffle'

export interface BoardSetup {
	columns: Columns
	pool: Verb[]
}

const MAX_ORDER_ATTEMPTS = 100

export function createCellId(verbId: number, form: VerbForm): string {
	return `${verbId}:${form}`
}

export function createCell(verb: Verb, form: VerbForm): Cell {
	return {
		id: createCellId(verb.id, form),
		verbId: verb.id,
		form,
		text: verb[form],
		meaning: form === 'present' ? verb.meaning : null,
	}
}

function sharesAnyRow(
	candidate: readonly Verb[],
	usedOrders: readonly (readonly Verb[])[],
): boolean {
	return usedOrders.some((order) => order.some((verb, index) => verb.id === candidate[index]?.id))
}

function shuffleIntoDiscordantOrder(
	verbs: readonly Verb[],
	usedOrders: readonly Verb[][],
	rng: Rng,
): Verb[] {
	let candidate = shuffle(verbs, rng)

	for (let attempt = 1; attempt < MAX_ORDER_ATTEMPTS; attempt++) {
		if (!sharesAnyRow(candidate, usedOrders)) break
		candidate = shuffle(verbs, rng)
	}

	return candidate
}

export function createBoard(
	verbs: readonly Verb[],
	boardSize: number,
	rng: Rng = Math.random,
): BoardSetup {
	const shuffledPool = shuffle(verbs, rng)
	const visibleCount = Math.max(0, Math.min(Math.floor(boardSize), shuffledPool.length))
	const visible = shuffledPool.slice(0, visibleCount)
	const pool = shuffledPool.slice(visibleCount)

	const usedOrders: Verb[][] = []

	function buildColumn(form: VerbForm): Cell[] {
		const order = shuffleIntoDiscordantOrder(visible, usedOrders, rng)
		usedOrders.push(order)
		return order.map((verb) => createCell(verb, form))
	}

	const columns: Columns = {
		present: buildColumn('present'),
		past: buildColumn('past'),
		participle: buildColumn('participle'),
	}

	return {columns, pool}
}

export function createEmptySelection(): Selection {
	return {present: null, past: null, participle: null}
}

export function findCell(columns: Columns, form: VerbForm, cellId: CellId): Cell | undefined {
	return columns[form].find((cell) => cell.id === cellId)
}

export function getSelectedCells(
	columns: Columns,
	selection: Selection,
): [Cell, Cell, Cell] | null {
	const present =
		selection.present === null ? undefined : findCell(columns, 'present', selection.present)
	const past = selection.past === null ? undefined : findCell(columns, 'past', selection.past)
	const participle =
		selection.participle === null
			? undefined
			: findCell(columns, 'participle', selection.participle)

	if (present === undefined || past === undefined || participle === undefined) return null

	return [present, past, participle]
}

export function isMatchingTriad(cells: readonly [Cell, Cell, Cell]): boolean {
	const [first, second, third] = cells
	return first.verbId === second.verbId && second.verbId === third.verbId
}

export function getCellStatus(
	cell: Cell,
	selection: Selection,
	errorCellIds: readonly CellId[],
	resolvedVerbIds: readonly number[],
): CellStatus {
	if (errorCellIds.includes(cell.id)) return 'error'
	if (resolvedVerbIds.includes(cell.verbId)) return 'resolved'
	if (selection[cell.form] === cell.id) return 'selected'
	return 'neutral'
}

interface FreeSlot {
	readonly row: number
	readonly verbId: number
}

function freeSlots(cells: readonly Cell[], resolvedVerbIds: readonly number[]): FreeSlot[] {
	return cells.flatMap((cell, row) =>
		resolvedVerbIds.includes(cell.verbId) ? [{row, verbId: cell.verbId}] : [],
	)
}

function hasDistinctAssignment(
	present: readonly FreeSlot[],
	past: readonly FreeSlot[],
	participle: readonly FreeSlot[],
): boolean {
	for (const presentSlot of present) {
		for (const pastSlot of past) {
			if (pastSlot.row === presentSlot.row) continue

			for (const participleSlot of participle) {
				if (participleSlot.row !== presentSlot.row && participleSlot.row !== pastSlot.row) {
					return true
				}
			}
		}
	}

	return false
}

function pickDistinctRows(
	presentSlots: readonly FreeSlot[],
	pastSlots: readonly FreeSlot[],
	participleSlots: readonly FreeSlot[],
	rng: Rng,
): [number, number, number] {
	const present = shuffle(presentSlots, rng)
	const past = shuffle(pastSlots, rng)
	const participle = shuffle(participleSlots, rng)

	let best: {penalty: number; rows: [number, number, number]} | null = null

	for (const presentSlot of present) {
		for (const pastSlot of past) {
			for (const participleSlot of participle) {
				const rows: [number, number, number] = [presentSlot.row, pastSlot.row, participleSlot.row]

				const aligned = new Set(rows).size !== rows.length
				const sameTriad =
					presentSlot.verbId === pastSlot.verbId && pastSlot.verbId === participleSlot.verbId

				const restPresent = present.filter((slot) => slot.row !== presentSlot.row)
				const restPast = past.filter((slot) => slot.row !== pastSlot.row)
				const restParticiple = participle.filter((slot) => slot.row !== participleSlot.row)

				const leavesWayOut =
					restPresent.length === 0 || hasDistinctAssignment(restPresent, restPast, restParticiple)

				const penalty = (sameTriad ? 4 : 0) + (aligned ? 2 : 0) + (leavesWayOut ? 0 : 1)

				if (best === null || penalty < best.penalty) best = {penalty, rows}
				if (penalty === 0) return rows
			}
		}
	}

	return best?.rows ?? [present[0]?.row ?? 0, past[0]?.row ?? 0, participle[0]?.row ?? 0]
}

function placeAt(cells: readonly Cell[], row: number, cell: Cell): Cell[] {
	const next = [...cells]
	next[row] = cell

	return next
}

export function refillSlots(
	columns: Columns,
	resolvedVerbIds: readonly number[],
	incoming: Verb | null,
	rng: Rng = Math.random,
): Columns {
	if (incoming === null) return columns

	const presentSlots = freeSlots(columns.present, resolvedVerbIds)
	const pastSlots = freeSlots(columns.past, resolvedVerbIds)
	const participleSlots = freeSlots(columns.participle, resolvedVerbIds)

	if (presentSlots.length === 0 || pastSlots.length === 0 || participleSlots.length === 0) {
		return columns
	}

	const [presentRow, pastRow, participleRow] = pickDistinctRows(
		presentSlots,
		pastSlots,
		participleSlots,
		rng,
	)

	return {
		present: placeAt(columns.present, presentRow, createCell(incoming, 'present')),
		past: placeAt(columns.past, pastRow, createCell(incoming, 'past')),
		participle: placeAt(columns.participle, participleRow, createCell(incoming, 'participle')),
	}
}
