
create or replace function public.record_practice_progress(entries jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
	caller uuid := (select auth.uid());
begin
	if caller is null then
		raise exception 'record_practice_progress requiere una sesión iniciada';
	end if;

	if jsonb_typeof(entries) <> 'array' then
		raise exception 'entries debe ser un array JSON';
	end if;

	insert into public.user_progress as progress (user_id, verb_id, hits, misses, last_practiced_at)
	select
		caller,
		(entry ->> 'verb_id')::integer,
		greatest(coalesce((entry ->> 'hits')::integer, 0), 0),
		greatest(coalesce((entry ->> 'misses')::integer, 0), 0),
		now()
	from jsonb_array_elements(entries) as entry
	where (entry ->> 'verb_id') is not null
	on conflict (user_id, verb_id) do update
		set
			hits = progress.hits + excluded.hits,
			misses = progress.misses + excluded.misses,
			last_practiced_at = now();
end;
$$;

revoke execute on function public.record_practice_progress(jsonb) from public, anon;

grant execute on function public.record_practice_progress(jsonb) to authenticated;
