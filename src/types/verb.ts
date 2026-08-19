/**
 * Tipos del catálogo de verbos irregulares.
 *
 * El catálogo vive en el cliente (`src/data/verbs.json`), no en Postgres
 * (ver `PLAN.md`, Bitácora de Decisiones, D2).
 */

/** Las tres formas verbales, en el orden en que se muestran las columnas. */
export const VERB_FORMS = ['present', 'past', 'participle'] as const

export type VerbForm = (typeof VERB_FORMS)[number]

/** Nivel de dificultad con el que viene etiquetado cada verbo en el catálogo. */
export const VERB_LEVELS = ['beginner', 'intermediate', 'advanced'] as const

export type VerbLevel = (typeof VERB_LEVELS)[number]

/**
 * Un verbo irregular con sus tres formas.
 *
 * Extiende `Record<VerbForm, string>` a propósito: así el tipo garantiza que
 * existe exactamente una propiedad por forma verbal, y permite indexar con
 * `verbo[forma]` de manera tipada al construir el tablero. Si algún día se
 * añade una cuarta forma a `VerbForm`, este tipo deja de compilar hasta que se
 * actualice el catálogo — que es justo lo que queremos.
 *
 * Nota: algunas formas contienen alternativas separadas por barra
 * (ej. `be` → `"was / were"`). Se tratan como una sola cadena: son una única
 * celda del tablero.
 */
export interface Verb extends Record<VerbForm, string> {
	readonly id: number
	readonly level: VerbLevel
	/**
	 * Significado en español, en infinitivo y minúscula (`beber`, `romper`).
	 *
	 * La propiedad va en inglés y su contenido en español, que es la regla de
	 * `CLAUDE.md` §5 para el texto visible: es lo mismo que `label: 'Fácil'` en
	 * `data/levels.ts`.
	 *
	 * **No es una forma verbal y por eso no entra en `VERB_FORMS`.** Si entrara,
	 * el tablero pintaría una cuarta columna y el Dojo preguntaría por ella. Es
	 * dato didáctico, no parte de la conjugación.
	 *
	 * Es una **glosa**, no una traducción exhaustiva: un verbo inglés no tiene
	 * un único equivalente, así que se guarda la acepción más común y corta. Los
	 * matices caben dentro de la propia cadena (`ser / estar`), igual que ya
	 * ocurre con `"was / were"` en `past`.
	 */
	readonly meaning: string
}
