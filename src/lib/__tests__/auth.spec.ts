import {describe, expect, it} from 'vitest'
import {
	FALLBACK_DISPLAY_NAME,
	GENERIC_AUTH_ERROR,
	describeAuthError,
	identityFromUser,
	readCallbackError,
} from '../auth'

function userWith(metadata: Record<string, unknown>, email?: string) {
	return {id: 'uuid-1', email, user_metadata: metadata}
}

describe('identityFromUser', () => {
	it('usa `full_name` cuando Google lo entrega', () => {
		const identity = identityFromUser(
			userWith({full_name: 'Ada Lovelace', name: 'Ada'}, 'ada@example.com'),
		)

		expect(identity.displayName).toBe('Ada Lovelace')
	})

	it('cae a `name` si no hay `full_name`', () => {
		expect(identityFromUser(userWith({name: 'Ada'})).displayName).toBe('Ada')
	})

	it('cae a la parte local del correo si no hay ningún nombre', () => {
		expect(identityFromUser(userWith({}, 'ada.lovelace@example.com')).displayName).toBe(
			'ada.lovelace',
		)
	})

	it('cae al nombre de respaldo sin nombre ni correo', () => {
		expect(identityFromUser(userWith({})).displayName).toBe(FALLBACK_DISPLAY_NAME)
	})

	it('ignora los nombres vacíos o de sólo espacios', () => {
		const identity = identityFromUser(userWith({full_name: '   ', name: 'Ada'}))

		expect(identity.displayName).toBe('Ada')
	})

	it('recorta los espacios sobrantes del nombre', () => {
		expect(identityFromUser(userWith({full_name: '  Ada  '})).displayName).toBe('Ada')
	})

	it('descarta los valores que no son texto', () => {
		const identity = identityFromUser(userWith({full_name: 42, name: null}, 'ada@example.com'))

		expect(identity.displayName).toBe('ada')
	})

	it('conserva el identificador tal cual', () => {
		expect(identityFromUser(userWith({})).userId).toBe('uuid-1')
	})

	it('lee el avatar de `avatar_url`', () => {
		const identity = identityFromUser(userWith({avatar_url: 'https://example.com/a.png'}))

		expect(identity.avatarUrl).toBe('https://example.com/a.png')
	})

	it('cae a `picture` si no hay `avatar_url`', () => {
		const identity = identityFromUser(userWith({picture: 'https://example.com/p.png'}))

		expect(identity.avatarUrl).toBe('https://example.com/p.png')
	})

	it('deja el avatar en nulo si no hay ninguno', () => {
		expect(identityFromUser(userWith({})).avatarUrl).toBeNull()
	})
})

describe('describeAuthError', () => {
	it('traduce los códigos conocidos en lugar de mostrar el mensaje original', () => {
		const error = Object.assign(new Error('Provider denied access'), {code: 'access_denied'})

		expect(describeAuthError(error)).toContain('Google denegó el acceso')
	})

	it('usa el mensaje del error cuando el código es desconocido', () => {
		const error = Object.assign(new Error('Fallo raro del proveedor'), {code: 'nope'})

		expect(describeAuthError(error)).toBe('Fallo raro del proveedor')
	})

	it('acepta un texto suelto', () => {
		expect(describeAuthError('  algo falló  ')).toBe('algo falló')
	})

	it('cae al mensaje genérico con un error sin mensaje', () => {
		expect(describeAuthError(new Error('   '))).toBe(GENERIC_AUTH_ERROR)
	})

	it('cae al mensaje genérico con valores que no son errores', () => {
		expect(describeAuthError(null)).toBe(GENERIC_AUTH_ERROR)
		expect(describeAuthError(undefined)).toBe(GENERIC_AUTH_ERROR)
		expect(describeAuthError({})).toBe(GENERIC_AUTH_ERROR)
		expect(describeAuthError('')).toBe(GENERIC_AUTH_ERROR)
	})
})

describe('readCallbackError', () => {
	it('no denuncia nada en un callback correcto', () => {
		expect(readCallbackError('?code=abc123', '')).toBeNull()
		expect(readCallbackError('', '')).toBeNull()
	})

	it('lee el error de la query, que es donde responde el flujo PKCE', () => {
		const message = readCallbackError('?error=access_denied', '')

		expect(message).toContain('Google denegó el acceso')
	})

	it('lee el error del fragmento', () => {
		const message = readCallbackError('', '#error=server_error&error_description=Boom')

		expect(message).toContain('Google no pudo completar el acceso')
	})

	it('prefiere `error_code` sobre `error` cuando llegan los dos', () => {
		const message = readCallbackError('?error=server_error&error_code=otp_expired', '')

		expect(message).toContain('caducó')
	})

	it('usa la descripción del proveedor si el código es desconocido', () => {
		const message = readCallbackError('?error=weird&error_description=Algo+muy+concreto', '')

		expect(message).toBe('Algo muy concreto')
	})

	it('menciona el código desconocido cuando no hay descripción', () => {
		expect(readCallbackError('?error=weird', '')).toContain('weird')
	})

	it('ignora un error vacío', () => {
		expect(readCallbackError('?error=', '')).toBeNull()
	})

	it('tolera el fragmento con y sin almohadilla', () => {
		expect(readCallbackError('', 'error=access_denied')).toContain('Google denegó el acceso')
	})
})
