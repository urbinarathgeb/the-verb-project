/**
 * Nombres y descripciones visibles de los modos de juego.
 *
 * Vive en un solo sitio porque ya se pagó el precio de no tenerlo: el renombrado
 * de `PLAN.md` (Bitácora, **D12**) —«Precisión» → «Supervivencia» y «Practicar
 * sin reloj» → «Dojo»— tuvo que tocar el menú, la pantalla de clasificación, la
 * de resultado y el onboarding, cada uno con su copia del mismo texto.
 *
 * Los identificadores (`target`, `precision`, `practice`) **no** se traducen:
 * son dominio y viajan a la columna `mode` de `game_sessions` (`CLAUDE.md` §5).
 * Lo que hay aquí es sólo su nombre de cara al jugador.
 */

import type {MenuMode} from '@/types/game'

export const MODE_LABELS: Record<MenuMode, string> = {
	target: 'Contrarreloj',
	precision: 'Supervivencia',
	practice: 'Dojo',
}

/** Una línea por modo, para el menú. El onboarding los explica más despacio. */
export const MODE_DESCRIPTIONS: Record<MenuMode, string> = {
	target: 'Empareja los verbos del objetivo antes de que se acabe el tiempo.',
	precision: 'Sin límite de tiempo, pero un solo error termina la partida.',
	practice: 'Sin reloj y sin perder: una forma, tres opciones y una racha que cuidar.',
}

/**
 * La regla que distingue a cada modo, en una frase corta.
 *
 * Existe aparte de `MODE_DESCRIPTIONS` porque cumple otra función: la
 * descripción invita, la regla advierte. En la pantalla de selección las tres se
 * ven a la vez, para que elegir modo sea comparar reglas y no adivinar cuál es
 * cuál — en Supervivencia un solo error termina la partida, y eso no puede
 * enterarse el jugador a los diez segundos de empezar.
 */
export const MODE_RULES: Record<MenuMode, string> = {
	target: 'Fallar resta segundos, no elimina.',
	precision: 'Un fallo y se acabó la partida.',
	practice: 'Sin reloj y sin perder.',
}
