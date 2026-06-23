create or replace function maintainer_analytics_trends(repo_names text[], as_of timestamptz default now())
returns jsonb
language sql
stable
as $$
  with bounds as (
    select
      date_trunc('week', as_of)::timestamptz as current_week,
      (date_trunc('week', as_of) - interval '11 weeks')::timestamptz as first_week,
      date_trunc('month', as_of)::timestamptz as current_month,
      (date_trunc('month', as_of) - interval '5 months')::timestamptz as first_month
  ),
  week_series as (
    select generate_series(bounds.first_week, bounds.current_week, interval '1 week') as week_start
    from bounds
  ),
  weekly_merges as (
    select date_trunc('week', merged_at)::timestamptz as week_start, count(*)::integer as merged_prs
    from pull_requests, bounds
    where repo_full_name = any(repo_names)
      and state = 'merged'
      and merged_at is not null
      and merged_at >= bounds.first_week
    group by 1
  ),
  weekly_xp as (
    select
      date_trunc('week', r.completed_at)::timestamptz as week_start,
      coalesce(sum(r.xp_reward), 0)::integer as xp_distributed
    from recommendations r
    join issues i on i.id = r.issue_id, bounds
    where i.repo_full_name = any(repo_names)
      and r.status = 'completed'
      and r.completed_at is not null
      and r.completed_at >= bounds.first_week
    group by 1
  ),
  weekly as (
    select jsonb_agg(
      jsonb_build_object(
        'weekStart', to_char(ws.week_start::date, 'YYYY-MM-DD'),
        'label', to_char(ws.week_start, 'Mon FMDD'),
        'mergedPrs', coalesce(wm.merged_prs, 0),
        'xpDistributed', coalesce(wx.xp_distributed, 0)
      )
      order by ws.week_start
    ) as data
    from week_series ws
    left join weekly_merges wm on wm.week_start = ws.week_start
    left join weekly_xp wx on wx.week_start = ws.week_start
  ),
  contributor_ids as (
    select distinct author_user_id as user_id
    from pull_requests
    where repo_full_name = any(repo_names)
      and author_user_id is not null
  ),
  month_series as (
    select generate_series(bounds.first_month, bounds.current_month, interval '1 month') as month_start
    from bounds
  ),
  level_snapshots as (
    select
      ms.month_start,
      least(ms.month_start + interval '1 month' - interval '1 second', as_of) as snapshot_at,
      p.id,
      coalesce(
        (
          select lu.from_level
          from level_ups lu
          where lu.user_id = p.id
            and lu.occurred_at > least(ms.month_start + interval '1 month' - interval '1 second', as_of)
          order by lu.occurred_at asc
          limit 1
        ),
        p.level,
        0
      ) as level
    from month_series ms
    join contributor_ids ci on true
    join profiles p on p.id = ci.user_id
    where p.created_at <= least(ms.month_start + interval '1 month' - interval '1 second', as_of)
  ),
  monthly_counts as (
    select 
      ms.month_start,
      coalesce(count(ls.id) filter (where ls.level <= 0), 0) as l0,
      coalesce(count(ls.id) filter (where ls.level = 1), 0) as l1,
      coalesce(count(ls.id) filter (where ls.level = 2), 0) as l2,
      coalesce(count(ls.id) filter (where ls.level >= 3), 0) as l3Plus
    from month_series ms
    left join level_snapshots ls on ls.month_start = ms.month_start
    group by ms.month_start
  ),
  level_distribution as (
    select jsonb_agg(
      jsonb_build_object(
        'monthStart', to_char(month_start::date, 'YYYY-MM-DD'),
        'label', to_char(month_start, 'Mon YYYY'),
        'l0', l0,
        'l1', l1,
        'l2', l2,
        'l3Plus', l3Plus
      )
      order by month_start
    ) as data
    from monthly_counts
  )
  select jsonb_build_object(
    'weekly', coalesce((select data from weekly), '[]'::jsonb),
    'levelDistribution', coalesce((select data from level_distribution), '[]'::jsonb)
  );
$$;
