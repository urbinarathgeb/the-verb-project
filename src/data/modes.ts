import type {MenuMode} from '@/types/game'

export const MODE_LABELS: Record<MenuMode, string> = {
	target: 'Contrarreloj',
	precision: 'Supervivencia',
	practice: 'Dojo',
}

export const MODE_DESCRIPTIONS: Record<MenuMode, string> = {
	target: 'Empareja los verbos del objetivo antes de que se acabe el tiempo.',
	precision: 'Sin límite de tiempo, pero un solo error termina la partida.',
	practice: 'Sin reloj y sin perder: una forma, tres opciones y una racha que cuidar.',
}

export const MODE_RULES: Record<MenuMode, string> = {
	target: 'Fallar resta segundos, no elimina.',
	precision: 'Un fallo y se acabó la partida.',
	practice: 'Sin reloj y sin perder.',
}
