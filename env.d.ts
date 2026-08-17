/// <reference types="vite/client" />

/**
 * Variables de entorno del cliente.
 *
 * Son opcionales a propósito: sin ellas la app arranca igual en modo invitado,
 * sin persistencia (`CLAUDE.md` §8). Tiparlas como opcionales obliga a
 * contemplar ese caso en vez de asumir que Supabase siempre está configurado.
 */
interface ImportMetaEnv {
	readonly VITE_SUPABASE_URL?: string
	readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
