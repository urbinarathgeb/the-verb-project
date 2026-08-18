-- =============================================================================
-- Ranking: columna `status` y vistas por modo
--
-- El ranking muestra el **mejor resultado por usuario**, no todas sus partidas
-- (`MECHANICS.md` §5). Sin eso, quien más jugara coparía la tabla con sus
-- propios intentos y el ranking dejaría de comparar personas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Desenlace de la partida
--
-- Falta en el schema inicial y hace falta aquí: en Modo Objetivo sólo entran al
-- ranking las partidas ganadas, y sin esta columna la base no puede distinguir
-- una victoria de una derrota. El filtro quedaría entonces sólo en el cliente,
-- que es justo lo que no debe decidir qué entra al ranking: cualquiera puede
-- insertar con la clave anónima una partida perdida con un tiempo ridículo.
--
-- La tabla está vacía (nadie ha jugado autenticado todavía), así que se puede
-- añadir como `not null` sin valor por defecto para las filas existentes.
-- -----------------------------------------------------------------------------
alter table public.game_sessions
	add column status text not null check (status in ('won', 'lost'));

-- -----------------------------------------------------------------------------
-- Índices
--
-- Los del schema inicial se diseñaron para un ranking plano —«los mejores
-- tiempos»— pero la consulta real es «el mejor tiempo *de cada usuario*», que se
-- resuelve con `distinct on` y necesita otro orden de columnas. Se sustituyen en
-- lugar de acumularlos: un índice que ninguna consulta usa sólo encarece las
-- escrituras.
--
-- El orden sigue la regla de la skill `supabase-postgres-best-practices`:
-- primero las columnas de igualdad, después las de agrupación y orden.
-- -----------------------------------------------------------------------------
drop index if exists public.game_sessions_target_ranking_idx;
drop index if exists public.game_sessions_precision_ranking_idx;

create index game_sessions_target_best_idx
	on public.game_sessions (mode, status, user_id, level, time_ms asc);

-- En Precisión el orden final es por ritmo, que es una expresión calculada y no
-- una columna. El índice cubre el filtro y la agrupación; ordenar por ritmo se
-- resuelve en memoria, que al volumen esperado de este ranking es el intercambio
-- correcto frente a mantener un índice de expresión.
create index game_sessions_precision_best_idx
	on public.game_sessions (mode, user_id, level);

-- -----------------------------------------------------------------------------
-- Ranking de Modo Objetivo: menor tiempo por usuario y nivel.
--
-- `distinct on` es la forma nativa de Postgres para «una fila por grupo»: toma
-- la primera de cada `(user_id, level)` según el `order by`, que por eso empieza
-- obligatoriamente por esas mismas columnas.
--
-- `security_invoker` hace que la vista se ejecute con los permisos de quien
-- consulta y no con los de quien la creó. Sin esa opción, una vista de Postgres
-- **salta el RLS de las tablas que lee**, y eso sería un agujero silencioso:
-- daría igual lo que digan las políticas de `game_sessions`.
-- -----------------------------------------------------------------------------
create view public.target_ranking
with (security_invoker = on) as
select distinct on (played.user_id, played.level)
	played.user_id,
	played.level,
	played.time_ms,
	played.errors,
	played.verbs_matched,
	played.completed_at,
	profile.display_name,
	profile.avatar_url
from public.game_sessions as played
join public.profiles as profile on profile.id = played.user_id
where played.mode = 'target' and played.status = 'won'
-- El desempate por `completed_at` no es decorativo: ante dos tiempos idénticos
-- fija un orden estable, y sin él la fila elegida podría variar entre consultas.
order by played.user_id, played.level, played.time_ms asc, played.completed_at asc;

-- -----------------------------------------------------------------------------
-- Ranking de Modo Precisión: mayor ritmo por usuario y nivel.
--
-- El ritmo no se almacena, se calcula (`MECHANICS.md` §6): guardar un valor
-- derivado abre la puerta a que quede inconsistente con sus operandos. La
-- división es segura porque la tabla tiene `check (time_ms > 0)`.
--
-- El piso de aciertos replica `MIN_MATCHES_FOR_RANKING` de `src/data/levels.ts`.
-- Está duplicado a propósito: la vista debe ser autoritativa sobre qué entra al
-- ranking, porque el cliente no es de fiar para filtrarlo. Si allí cambia el
-- valor, hay que cambiarlo aquí con una migración nueva.
-- -----------------------------------------------------------------------------
create view public.precision_ranking
with (security_invoker = on) as
select distinct on (played.user_id, played.level)
	played.user_id,
	played.level,
	played.verbs_matched,
	played.time_ms,
	played.completed_at,
	(played.verbs_matched::numeric * 60000) / played.time_ms as pace,
	profile.display_name,
	profile.avatar_url
from public.game_sessions as played
join public.profiles as profile on profile.id = played.user_id
where played.mode = 'precision' and played.verbs_matched >= 5
order by
	played.user_id,
	played.level,
	(played.verbs_matched::numeric * 60000) / played.time_ms desc,
	played.completed_at asc;

-- El ranking es visible para todos, igual que las tablas que lo alimentan. Se
-- concede explícitamente en lugar de confiar en los privilegios por defecto del
-- schema, para que quede escrito quién puede leer qué.
grant select on public.target_ranking to anon, authenticated;
grant select on public.precision_ranking to anon, authenticated;
