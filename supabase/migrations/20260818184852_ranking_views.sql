
alter table public.game_sessions
	add column status text not null check (status in ('won', 'lost'));

drop index if exists public.game_sessions_target_ranking_idx;
drop index if exists public.game_sessions_precision_ranking_idx;

create index game_sessions_target_best_idx
	on public.game_sessions (mode, status, user_id, level, time_ms asc);

create index game_sessions_precision_best_idx
	on public.game_sessions (mode, user_id, level);

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
order by played.user_id, played.level, played.time_ms asc, played.completed_at asc;

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

grant select on public.target_ranking to anon, authenticated;
grant select on public.precision_ranking to anon, authenticated;
