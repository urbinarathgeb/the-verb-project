import type {User} from '@supabase/supabase-js'

/**
 * Lógica pura de autenticación: derivar la identidad visible de un usuario y
 * traducir los fallos a mensajes que una persona pueda leer.
 *
 * Vive aquí, separada de `stores/auth.ts`, porque es la parte con reglas de
 * verdad —cadenas de respaldo y traducción de códigos de error— y así se puede
 * testear sin simular el cliente de Supabase.
 */

/** Identidad del jugador tal como se muestra en la interfaz y en el ranking. */
export interface AuthIdentity {
	readonly userId: string
	readonly displayName: string
	readonly avatarUrl: string | null
}

/**
 * Último recurso para el nombre. Nunca debería aparecer con Google, que siempre
 * manda nombre y correo, pero el ranking no puede tener una fila sin nombre.
 */
export const FALLBACK_DISPLAY_NAME = 'Jugador'

/** Mensaje cuando no hay nada más concreto que decir. */
export const GENERIC_AUTH_ERROR = 'No se pudo completar el acceso. Inténtalo de nuevo.'

/**
 * Traducción de los códigos de error que devuelven Google y Supabase Auth.
 *
 * Se traducen a propósito en lugar de mostrar el `error_description` original:
 * llega en inglés y es texto para desarrolladores. `access_denied` merece
 * mención especial porque es ambiguo —cancelar la pantalla de permisos y no
 * estar en la lista de usuarios de prueba dan el mismo código— y sin explicarlo
 * parece un fallo de la aplicación.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
	access_denied:
		'Google denegó el acceso. Puede que cancelaras la pantalla de permisos, o que tu cuenta no esté autorizada todavía.',
	server_error: 'Google no pudo completar el acceso. Inténtalo de nuevo en un momento.',
	temporarily_unavailable:
		'El servicio de acceso no está disponible ahora mismo. Inténtalo más tarde.',
	otp_expired: 'El enlace de acceso caducó. Vuelve a iniciar sesión.',
	bad_oauth_state:
		'La respuesta de Google no coincide con la petición. Vuelve a empezar el acceso desde el menú.',
	flow_state_expired: 'Tardó demasiado y el acceso caducó. Vuelve a intentarlo.',
}

/** Lee una propiedad de texto no vacía de los metadatos del usuario. */
function readString(metadata: Record<string, unknown>, key: string): string | null {
	const value = metadata[key]

	if (typeof value !== 'string') return null

	const trimmed = value.trim()

	return trimmed === '' ? null : trimmed
}

/** La parte del correo antes de la arroba, como nombre de respaldo. */
function emailLocalPart(email: string | undefined): string | null {
	if (email === undefined) return null

	const local = email.split('@')[0]?.trim()

	return local === undefined || local === '' ? null : local
}

/**
 * Identidad visible de un usuario autenticado.
 *
 * El nombre se busca por una cadena de respaldos porque Google no es
 * consistente: entrega el nombre en `full_name` o en `name` según el flujo, y el
 * avatar en `avatar_url` o en `picture`. Recibe un `Pick` en lugar de un `User`
 * completo para que los tests no tengan que construir el objeto entero.
 */
export function identityFromUser(user: Pick<User, 'id' | 'email' | 'user_metadata'>): AuthIdentity {
	const metadata: Record<string, unknown> = user.user_metadata

	return {
		userId: user.id,
		displayName:
			readString(metadata, 'full_name') ??
			readString(metadata, 'name') ??
			emailLocalPart(user.email) ??
			FALLBACK_DISPLAY_NAME,
		avatarUrl: readString(metadata, 'avatar_url') ?? readString(metadata, 'picture'),
	}
}

/** Mensaje para un código de error conocido, con la descripción como respaldo. */
function messageForCode(code: string, description: string | null): string {
	const known = AUTH_ERROR_MESSAGES[code]

	if (known !== undefined) return known
	if (description !== null && description.trim() !== '') return description.trim()

	return `${GENERIC_AUTH_ERROR} (${code})`
}

/** Convierte cualquier cosa lanzada o devuelta por Supabase Auth en un mensaje. */
export function describeAuthError(error: unknown): string {
	if (typeof error === 'string') {
		return error.trim() === '' ? GENERIC_AUTH_ERROR : error.trim()
	}

	if (error instanceof Error) {
		// `AuthError` de Supabase añade un `code` estable; el `message` cambia.
		const code = 'code' in error && typeof error.code === 'string' ? error.code : null
		const known = code === null ? undefined : AUTH_ERROR_MESSAGES[code]

		if (known !== undefined) return known

		return error.message.trim() === '' ? GENERIC_AUTH_ERROR : error.message.trim()
	}

	return GENERIC_AUTH_ERROR
}

/**
 * Error devuelto por el proveedor en la URL del callback, si lo hay.
 *
 * Se miran la query **y** el fragmento porque el sitio depende del flujo: el
 * flujo PKCE que usa `@supabase/supabase-js` por defecto responde en la query
 * (`?error=…`), pero el flujo implícito y algunos errores de Supabase llegan en
 * el fragmento (`#error=…`). Mirar sólo uno deja fallos invisibles, y un fallo
 * invisible aquí se ve como un acceso que no hace nada.
 *
 * Devuelve `null` cuando la URL no denuncia ningún error, que es el caso normal.
 */
export function readCallbackError(search: string, hash: string): string | null {
	const sources = [search, hash].map(
		// `URLSearchParams` ya tolera el '?' inicial, pero no el '#'.
		(raw) => new URLSearchParams(raw.startsWith('#') ? raw.slice(1) : raw),
	)

	for (const params of sources) {
		const code = params.get('error_code') ?? params.get('error')

		if (code === null || code.trim() === '') continue

		return messageForCode(code.trim(), params.get('error_description'))
	}

	return null
}
