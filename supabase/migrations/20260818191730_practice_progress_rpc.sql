-- =============================================================================
-- Sincronización del progreso del Modo Práctica
--
-- El cliente acumula **incrementos** (cuántos aciertos y fallos nuevos por
-- verbo) y los envía en lote. Esta función los suma a lo que ya haya.
--
-- Por qué una función y no el upsert de PostgREST: un upsert normal **sustituye**
-- la fila, así que el cliente tendría que mandar totales absolutos calculados a
-- partir de su copia local. Si la misma persona practica en el móvil y luego en
-- el portátil sin recargar, la segunda pestaña escribiría totales viejos y
-- borraría lo aprendido en la primera. Sumar del lado del servidor hace que el
-- orden de llegada deje de importar.
-- =============================================================================

create or replace function public.record_practice_progress(entries jsonb)
returns void
language plpgsql
-- `security invoker` a propósito: la función corre con los permisos de quien
-- llama, así que RLS sigue aplicándose sobre `user_progress`. Es la segunda
-- barrera; la primera es que el `user_id` no se acepta del cliente, se toma de
-- `auth.uid()` aquí dentro, de modo que nadie puede escribir progreso ajeno.
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

	-- El alias `progress` evita ambigüedad al referirse a la fila existente en
	-- `on conflict`, que con `search_path` vacío conviene no dejar al azar.
	insert into public.user_progress as progress (user_id, verb_id, hits, misses, last_practiced_at)
	select
		caller,
		(entry ->> 'verb_id')::integer,
		-- `greatest(…, 0)` descarta incrementos negativos: sin esto, una llamada
		-- manipulada podría restar fallos y fabricarse un verbo «dominado».
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

-- Sólo tiene sentido para usuarios con sesión: un invitado no tiene progreso que
-- guardar. Se revoca primero de todos para no depender de los privilegios por
-- defecto, que conceden ejecución a `public`.
revoke execute on function public.record_practice_progress(jsonb) from public, anon;

grant execute on function public.record_practice_progress(jsonb) to authenticated;
