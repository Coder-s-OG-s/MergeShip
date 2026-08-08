'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { rateLimit } from '@/lib/rate-limit';

export type UsageEntry = {
  id: number;
  kind: string;
  createdAt: string;
  detail: Record<string, unknown> | null;
};

export type WeeklyXpPoint = {
  week: string;
  xp: number;
};

export type UsageSummary = {
  todayXp: number;
  weekXp: number;
  weeklyXp: WeeklyXpPoint[];
  entries: UsageEntry[];
};

/**
 * "Your usage" — surfaces the 30-day activity_log for the signed-in user
 * plus today + week XP totals. Read-only.
 */
export async function getUsage(limit = 100): Promise<UsageSummary> {
  const empty: UsageSummary = { todayXp: 0, weekXp: 0, weeklyXp: [], entries: [] };
  const sb = await getServerSupabase();
  if (!sb) return empty;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return empty;

  const limited = await rateLimit({
    namespace: 'usage:get',
    key: user.id,
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return empty;

  const service = getServiceSupabase();
  if (!service) return empty;

  // Calendar-aligned windows. dayStart = today 00:00 UTC; weekStart = the
  // current UTC calendar week's Monday 00:00 (same date_trunc('week')
  // boundaries the maintainer analytics use), so the week total is stable
  // within a day and comparable to the weekly chart.
  const now = new Date();
  const dayStart = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z').toISOString();
  const daysSinceMonday = (now.getUTCDay() + 6) % 7; // 0 = Sunday
  const weekStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday),
  ).toISOString();
  // Last 84 days of xp_events feed the 12-week chart.
  const chartStart = new Date(Date.now() - 84 * 24 * 3600 * 1000).toISOString();

  const [logRes, todayRes, weekRes, chartRes] = await Promise.all([
    service
      .from('activity_log')
      .select('id, kind, detail, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    service.from('xp_events').select('xp_delta').eq('user_id', user.id).gte('created_at', dayStart),
    service
      .from('xp_events')
      .select('xp_delta')
      .eq('user_id', user.id)
      .gte('created_at', weekStart),
    service
      .from('xp_events')
      .select('xp_delta, created_at')
      .eq('user_id', user.id)
      .gte('created_at', chartStart),
  ]);

  const todayXp = (todayRes.data ?? []).reduce((a, r) => a + (r.xp_delta ?? 0), 0);
  const weekXp = (weekRes.data ?? []).reduce((a, r) => a + (r.xp_delta ?? 0), 0);

  const weeklyXp = getWeeklyXp(
    (chartRes.data ?? []).map((r) => ({
      createdAt: r.created_at,
      xp: r.xp_delta ?? 0,
    })),
  );

  const entries: UsageEntry[] = (logRes.data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAt: r.created_at,
    detail: (r.detail as Record<string, unknown> | null) ?? null,
  }));

  return { todayXp, weekXp, weeklyXp, entries };
}

/**
 * Bucket XP amounts into the last `weeks` UTC calendar weeks (Monday 00:00
 * start — the same `date_trunc('week')` boundary used for `weekXp`), so the
 * chart's bars match the "XP this week" stat card. Oldest week first.
 */
export function getWeeklyXp(
  events: { createdAt: string; xp: number }[],
  weeks = 12,
): WeeklyXpPoint[] {
  const buckets: Record<string, number> = {};
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (todayUtc.getUTCDay() + 6) % 7; // 0 = Sunday
  const thisMonday = new Date(todayUtc);
  thisMonday.setUTCDate(todayUtc.getUTCDate() - daysSinceMonday);

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setUTCDate(thisMonday.getUTCDate() - i * 7);
    buckets[weekKey(d)] = 0;
  }

  for (const e of events) {
    const date = new Date(e.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const key = weekKey(d);
    if (key in buckets) buckets[key] = (buckets[key] ?? 0) + e.xp;
  }

  return Object.entries(buckets).map(([week, xp]) => ({ week, xp }));
}

function weekKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
