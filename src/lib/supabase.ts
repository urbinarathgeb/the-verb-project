import {createClient, type SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '@/types/database'

/**
 * Cliente de Supabase.
 *
 * La app es 100 % de navegador: no hay backend propio. El navegador habla
 * directamente con Supabase a través de PostgREST, y la seguridad la aplica
 * **Row Level Security** en la base de datos usando el JWT del usuario. Por eso
 * las políticas de `supabase/migrations/` no son una capa opcional: son *la*
 * capa de seguridad.
 *
 * La `anon key` es pública por diseño —viaja en el bundle— y no concede más
 * permisos de los que otorgue RLS. La `service_role`, en cambio, salta RLS y
 * **nunca** debe entrar en este proyecto.
 */

function createSupabaseClient(): SupabaseClient<Database> | null {
	const url = import.meta.env.VITE_SUPABASE_URL
	const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

	// Sin credenciales la app sigue siendo jugable: el modo invitado no persiste
	// nada (`CLAUDE.md` §8). Degradar es preferible a romper al arrancar.
	if (url === undefined || url === '' || anonKey === undefined || anonKey === '') return null

	return createClient<Database>(url, anonKey, {
		auth: {
			// La sesión sobrevive a recargas y se renueva sola.
			persistSession: true,
			autoRefreshToken: true,
			// Necesario para el callback de OAuth, que llega con el token en la URL.
			detectSessionInUrl: true,
		},
	})
}

/**
 * Instancia única, o `null` si no hay credenciales.
 *
 * Devolver `null` en lugar de lanzar obliga a quien lo use a contemplar el caso
 * «sin backend», que es un estado legítimo de la app y no un error.
 */
export const supabase = createSupabaseClient()

/** ¿Hay backend disponible? Si no, la app funciona en modo invitado. */
export const isSupabaseConfigured = supabase !== null
