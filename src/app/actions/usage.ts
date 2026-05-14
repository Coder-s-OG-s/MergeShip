'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export type UsageEntry = {
  id: number;
  kind: string;
  createdAt: string;
  detail: Record<string, unknown> | null;
};

export type UsageSummary = {
  todayXp: number;
  weekXp: number;
  entries: UsageEntry[];
};

/**
 * "Your usage" — surfaces the 30-day activity_log for the signed-in user
 * plus today + week XP totals. Read-only.
 */
export async function getUsage(limit = 100): Promise<UsageSummary> {
  const empty: UsageSummary = { todayXp: 0, weekXp: 0, entries: [] };
  const sb = getServerSupabase();
  if (!sb) return empty;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return empty;

  const service = getServiceSupabase();
  if (!service) return empty;

  const dayStart = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').toISOString();
  const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [logRes, todayRes, weekRes] = await Promise.all([
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
  ]);

  const todayXp = (todayRes.data ?? []).reduce((a, r) => a + (r.xp_delta ?? 0), 0);
  const weekXp = (weekRes.data ?? []).reduce((a, r) => a + (r.xp_delta ?? 0), 0);

  const entries: UsageEntry[] = (logRes.data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAt: r.created_at,
    detail: (r.detail as Record<string, unknown> | null) ?? null,
  }));

  return { todayXp, weekXp, entries };
}
