import type {SupabaseClient} from '@supabase/supabase-js'
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
 *
 * **El SDK se carga bajo demanda.** `@supabase/supabase-js` arrastra consigo
 * `realtime-js`, `storage-js` y `functions-js`, tres dependencias que este
 * proyecto no usa en ninguna línea: sólo se llama a `auth`, `from()` y `rpc()`.
 * Importarlo de forma estática lo metía entero en el chunk de arranque de un
 * juego que, por diseño, es completamente jugable como invitado y sin backend
 * (`CLAUDE.md` §8). Con el `import()` dinámico, quien no inicia sesión ni abre
 * la clasificación nunca llega a descargarlo.
 */

export type AppSupabaseClient = SupabaseClient<Database>

/** Credenciales del entorno, o `null` si falta alguna. */
function readCredentials(): {url: string; anonKey: string} | null {
	const url = import.meta.env.VITE_SUPABASE_URL
	const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

	// Sin credenciales la app sigue siendo jugable: el modo invitado no persiste
	// nada (`CLAUDE.md` §8). Degradar es preferible a romper al arrancar.
	if (url === undefined || url === '' || anonKey === undefined || anonKey === '') return null

	return {url, anonKey}
}

/**
 * ¿Hay backend disponible? Si no, la app funciona en modo invitado.
 *
 * Sigue siendo síncrono a propósito: sólo lee variables de entorno, así que la
 * interfaz puede decidir al instante si ofrece el botón de acceso sin esperar a
 * que se descargue el SDK.
 */
export const isSupabaseConfigured = readCredentials() !== null

/** Promesa memorizada: el cliente se crea una sola vez por sesión. */
let pending: Promise<AppSupabaseClient | null> | null = null

async function createSupabaseClient(): Promise<AppSupabaseClient | null> {
	const credentials = readCredentials()
	if (credentials === null) return null

	const {createClient} = await import('@supabase/supabase-js')

	return createClient<Database>(credentials.url, credentials.anonKey, {
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
 * «sin backend», que es un estado legítimo de la app y no un error. Se memoriza
 * la **promesa** y no el cliente para que dos llamadas simultáneas no creen dos
 * clientes: el segundo sobrescribiría el `onAuthStateChange` del primero.
 */
export function getSupabase(): Promise<AppSupabaseClient | null> {
	pending ??= createSupabaseClient()

	return pending
}
