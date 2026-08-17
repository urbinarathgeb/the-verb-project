/**
 * Tipos de la base de datos.
 *
 * **Este archivo se genera**, no se edita a mano:
 *
 * ```sh
 * pnpm supabase gen types typescript --linked > src/types/database.ts
 * ```
 *
 * Hasta que exista un proyecto de Supabase enlazado, se mantiene esta versión
 * escrita a mano que refleja las migraciones de `supabase/migrations/`. Sirve
 * para tipar el cliente y para que el proyecto compile sin backend.
 */

import type {Difficulty, GameMode} from './game'

export interface Database {
	/**
	 * Metadatos que `supabase-js` espera encontrar en el tipo generado. El
	 * generador los incluye; aquí se reproducen a mano mientras el tipo es
	 * provisional.
	 */
	__InternalSupabase: {
		PostgrestVersion: '12'
	}
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string
					display_name: string | null
					avatar_url: string | null
					created_at: string
				}
				Insert: {
					id: string
					display_name?: string | null
					avatar_url?: string | null
					created_at?: string
				}
				Update: {
					display_name?: string | null
					avatar_url?: string | null
				}
			}
			game_sessions: {
				Row: {
					id: string
					user_id: string
					mode: GameMode
					level: Difficulty
					time_ms: number
					errors: number
					verbs_matched: number
					completed_at: string
				}
				Insert: {
					id?: string
					user_id: string
					mode: GameMode
					level: Difficulty
					time_ms: number
					errors?: number
					verbs_matched: number
					completed_at?: string
				}
				Update: never
			}
			user_progress: {
				Row: {
					user_id: string
					verb_id: number
					hits: number
					misses: number
					last_practiced_at: string
				}
				Insert: {
					user_id: string
					verb_id: number
					hits?: number
					misses?: number
					last_practiced_at?: string
				}
				Update: {
					hits?: number
					misses?: number
					last_practiced_at?: string
				}
			}
		}
	}
}
