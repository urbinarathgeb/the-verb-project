import type {SupabaseClient} from '@supabase/supabase-js'
import type {Database} from '@/types/database'

export type AppSupabaseClient = SupabaseClient<Database>

function readCredentials(): {url: string; anonKey: string} | null {
	const url = import.meta.env.VITE_SUPABASE_URL
	const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

	if (url === undefined || url === '' || anonKey === undefined || anonKey === '') return null

	return {url, anonKey}
}

export const isSupabaseConfigured = readCredentials() !== null

let pending: Promise<AppSupabaseClient | null> | null = null

async function createSupabaseClient(): Promise<AppSupabaseClient | null> {
	const credentials = readCredentials()
	if (credentials === null) return null

	const {createClient} = await import('@supabase/supabase-js')

	return createClient<Database>(credentials.url, credentials.anonKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
		},
	})
}

export function getSupabase(): Promise<AppSupabaseClient | null> {
	pending ??= createSupabaseClient()

	return pending
}
