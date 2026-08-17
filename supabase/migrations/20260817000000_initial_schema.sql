-- =============================================================================
-- Schema inicial de The Verb Project
--
-- La app no tiene backend propio: el navegador habla directamente con Supabase.
-- Por eso RLS no es una capa defensiva adicional, es LA capa de seguridad.
-- Toda tabla lleva RLS activo y políticas explícitas.
--
-- Nota de diseño: el catálogo de verbos NO vive aquí. Es estático y pequeño, y
-- se sirve desde `src/data/verbs.json`; `user_progress.verb_id` referencia el id
-- de ese JSON (ver PLAN.md, Bitácora, D2).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
--
-- `auth.users` no es legible entre usuarios en Supabase, y el ranking necesita
-- mostrar el nombre y el avatar de otros jugadores (PLAN.md, Bitácora, P3).
-- -----------------------------------------------------------------------------
create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	display_name text,
	avatar_url text,
	created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Lectura pública: el ranking muestra perfiles ajenos.
create policy profiles_select_public on public.profiles
	for select
	to anon, authenticated
	using (true);

-- Escritura sólo del dueño. `(select auth.uid())` se evalúa una vez por consulta
-- en lugar de una vez por fila, que es la diferencia entre una política rápida y
-- una que se arrastra en tablas grandes.
create policy profiles_update_own on public.profiles
	for update
	to authenticated
	using ((select auth.uid()) = id)
	with check ((select auth.uid()) = id);

-- -----------------------------------------------------------------------------
-- Alta automática de perfil
--
-- Se puebla por trigger y no desde el cliente: así no existe el hueco en el que
-- un usuario recién registrado no tiene perfil y el ranking no puede nombrarlo.
--
-- `security definer` es necesario porque el trigger escribe en `profiles` en
-- nombre de un usuario que aún no tiene sesión. `set search_path = ''` evita el
-- secuestro por search_path, obligando a calificar cada nombre.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.profiles (id, display_name, avatar_url)
	values (
		new.id,
		-- Google entrega el nombre en `full_name` o en `name` según el flujo.
		coalesce(
			new.raw_user_meta_data ->> 'full_name',
			new.raw_user_meta_data ->> 'name'
		),
		new.raw_user_meta_data ->> 'avatar_url'
	)
	-- Si el perfil ya existe, no es un error: el alta debe ser idempotente.
	on conflict (id) do nothing;

	return new;
end;
$$;

create trigger on_auth_user_created
	after insert on auth.users
	for each row
	execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- game_sessions
--
-- Una fila por partida terminada de los modos competitivos.
--
-- `user_id` es NOT NULL: el modo invitado no persiste nada, así que una fila sin
-- usuario sería inalcanzable (PLAN.md, Bitácora, P2).
-- -----------------------------------------------------------------------------
create table public.game_sessions (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	mode text not null check (mode in ('target', 'precision')),
	level text not null check (level in ('easy', 'medium', 'hard')),
	-- Toda partida dura algo; un 0 delataría un dato corrupto o manipulado.
	time_ms integer not null check (time_ms > 0),
	errors integer not null default 0 check (errors >= 0),
	verbs_matched integer not null check (verbs_matched >= 0),
	completed_at timestamptz not null default now()
);

alter table public.game_sessions enable row level security;

-- Lectura pública: alimenta el ranking, que es visible para todos.
create policy game_sessions_select_public on public.game_sessions
	for select
	to anon, authenticated
	using (true);

-- Sólo se pueden insertar partidas propias. Sin esta comprobación, cualquiera
-- podría escribir resultados a nombre de otro usuario.
create policy game_sessions_insert_own on public.game_sessions
	for insert
	to authenticated
	with check ((select auth.uid()) = user_id);

-- Las partidas son inmutables: no hay políticas de update ni de delete, así que
-- un resultado no se puede retocar a posteriori para mejorar el ranking.

-- Índices del ranking. Son compuestos y en el orden en que se filtra y ordena:
-- primero las columnas de igualdad (mode, level) y después la de orden.
create index game_sessions_target_ranking_idx
	on public.game_sessions (mode, level, time_ms asc);

create index game_sessions_precision_ranking_idx
	on public.game_sessions (mode, level, verbs_matched desc, time_ms asc);

-- La política de insert filtra por `user_id`, así que necesita su propio índice.
create index game_sessions_user_id_idx on public.game_sessions (user_id);

-- -----------------------------------------------------------------------------
-- user_progress
--
-- Aciertos y fallos por verbo, alimentado por el Modo Práctica. La clave
-- compuesta permite el upsert incremental sin leer antes.
-- -----------------------------------------------------------------------------
create table public.user_progress (
	user_id uuid not null references auth.users (id) on delete cascade,
	-- Referencia al id de `src/data/verbs.json`, no a una tabla.
	verb_id integer not null,
	hits integer not null default 0 check (hits >= 0),
	misses integer not null default 0 check (misses >= 0),
	last_practiced_at timestamptz not null default now(),
	primary key (user_id, verb_id)
);

alter table public.user_progress enable row level security;

-- El progreso es privado: a diferencia del ranking, nadie más lo ve.
create policy user_progress_all_own on public.user_progress
	for all
	to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

-- La clave primaria ya empieza por `user_id`, así que cubre las consultas de la
-- política y no hace falta un índice adicional.
