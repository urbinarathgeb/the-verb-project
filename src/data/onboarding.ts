/**
 * Texto del onboarding «¿Cómo se juega?».
 *
 * Vive aquí y no incrustado en el template para poder revisar la redacción sin
 * tocar el componente: es contenido de producto, y se espera que cambie más a
 * menudo que el marcado que lo pinta.
 *
 * Está redactado desde `PRODUCT.md` §4 —estudiantes de nivel básico e
 * intermedio, y autodidactas— así que evita vocabulario del proyecto: aquí no se
 * habla de «tríadas», «pool» ni «modo Objetivo».
 */

import {MODE_LABELS} from './modes'

export interface OnboardingSection {
	readonly title: string
	/** Párrafos del bloque. Se pintan en orden. */
	readonly body: readonly string[]
}

export const ONBOARDING_TITLE = '¿Cómo se juega?'

export const ONBOARDING_SECTIONS: readonly OnboardingSection[] = [
	{
		title: 'La idea',
		body: [
			'Cada verbo irregular en inglés tiene tres formas: presente, pasado y participio. Por ejemplo: go, went, gone.',
			'El juego te muestra tres columnas, una por forma, y tú las emparejas. En vez de estudiar la tabla, la reconstruyes.',
		],
	},
	{
		title: 'Cómo emparejar',
		body: [
			'Toca una celda de cada columna: la del presente, la del pasado y la del participio del mismo verbo. Puedes hacerlo en cualquier orden.',
			// La regla menos evidente del juego, y la que más frustra si no se dice.
			'Ojo: cada columna está desordenada por separado, así que estar en la misma fila NO significa que sean el mismo verbo.',
			'Si aciertas, las tres celdas se apagan y unos segundos después entran verbos nuevos en su lugar. Si fallas, se deseleccionan y siguen ahí.',
		],
	},
	{
		title: 'Las tres formas de jugar',
		body: [
			// El nombre sale de `modes.ts` y la explicación se queda aquí: si un modo
			// se vuelve a renombrar, este texto no hay que tocarlo.
			`${MODE_LABELS.target}: empareja los verbos del objetivo antes de que se acabe el tiempo. Fallar no te elimina, pero te resta segundos.`,
			`${MODE_LABELS.precision}: sin límite de tiempo, pero un solo fallo termina la partida. Cuenta cuántos verbos emparejas y a qué ritmo.`,
			`${MODE_LABELS.practice}: sin reloj y sin perder. Te muestra una forma y te pregunta por otra, con tres opciones. Es donde se aprende sin prisa.`,
		],
	},
]
