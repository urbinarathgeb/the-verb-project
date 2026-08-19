
create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	display_name text,
	avatar_url text,
	created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_public on public.profiles
	for select
	to anon, authenticated
	using (true);

create policy profiles_update_own on public.profiles
	for update
	to authenticated
	using ((select auth.uid()) = id)
	with check ((select auth.uid()) = id);

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
		coalesce(
			new.raw_user_meta_data ->> 'full_name',
			new.raw_user_meta_data ->> 'name'
		),
		new.raw_user_meta_data ->> 'avatar_url'
	)
	on conflict (id) do nothing;

	return new;
end;
$$;

create trigger on_auth_user_created
	after insert on auth.users
	for each row
	execute function public.handle_new_user();

create table public.game_sessions (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	mode text not null check (mode in ('target', 'precision')),
	level text not null check (level in ('easy', 'medium', 'hard')),
	time_ms integer not null check (time_ms > 0),
	errors integer not null default 0 check (errors >= 0),
	verbs_matched integer not null check (verbs_matched >= 0),
	completed_at timestamptz not null default now()
);

alter table public.game_sessions enable row level security;

create policy game_sessions_select_public on public.game_sessions
	for select
	to anon, authenticated
	using (true);

create policy game_sessions_insert_own on public.game_sessions
	for insert
	to authenticated
	with check ((select auth.uid()) = user_id);


create index game_sessions_target_ranking_idx
	on public.game_sessions (mode, level, time_ms asc);

create index game_sessions_precision_ranking_idx
	on public.game_sessions (mode, level, verbs_matched desc, time_ms asc);

create index game_sessions_user_id_idx on public.game_sessions (user_id);

create table public.user_progress (
	user_id uuid not null references auth.users (id) on delete cascade,
	verb_id integer not null,
	hits integer not null default 0 check (hits >= 0),
	misses integer not null default 0 check (misses >= 0),
	last_practiced_at timestamptz not null default now(),
	primary key (user_id, verb_id)
);

alter table public.user_progress enable row level security;

create policy user_progress_all_own on public.user_progress
	for all
	to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

