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
