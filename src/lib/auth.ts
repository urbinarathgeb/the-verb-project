import type {User} from '@supabase/supabase-js'

export interface AuthIdentity {
	readonly userId: string
	readonly displayName: string
	readonly avatarUrl: string | null
}

export const FALLBACK_DISPLAY_NAME = 'Jugador'

export const GENERIC_AUTH_ERROR = 'No se pudo completar el acceso. Inténtalo de nuevo.'

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

function readString(metadata: Record<string, unknown>, key: string): string | null {
	const value = metadata[key]

	if (typeof value !== 'string') return null

	const trimmed = value.trim()

	return trimmed === '' ? null : trimmed
}

function emailLocalPart(email: string | undefined): string | null {
	if (email === undefined) return null

	const local = email.split('@')[0]?.trim()

	return local === undefined || local === '' ? null : local
}

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

function messageForCode(code: string, description: string | null): string {
	const known = AUTH_ERROR_MESSAGES[code]

	if (known !== undefined) return known
	if (description !== null && description.trim() !== '') return description.trim()

	return `${GENERIC_AUTH_ERROR} (${code})`
}

export function describeAuthError(error: unknown): string {
	if (typeof error === 'string') {
		return error.trim() === '' ? GENERIC_AUTH_ERROR : error.trim()
	}

	if (error instanceof Error) {
		const code = 'code' in error && typeof error.code === 'string' ? error.code : null
		const known = code === null ? undefined : AUTH_ERROR_MESSAGES[code]

		if (known !== undefined) return known

		return error.message.trim() === '' ? GENERIC_AUTH_ERROR : error.message.trim()
	}

	return GENERIC_AUTH_ERROR
}

export function readCallbackError(search: string, hash: string): string | null {
	const sources = [search, hash].map(
		(raw) => new URLSearchParams(raw.startsWith('#') ? raw.slice(1) : raw),
	)

	for (const params of sources) {
		const code = params.get('error_code') ?? params.get('error')

		if (code === null || code.trim() === '') continue

		return messageForCode(code.trim(), params.get('error_description'))
	}

	return null
}
