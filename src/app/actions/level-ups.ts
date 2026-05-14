'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';

export type LevelUpRow = {
  id: number;
  fromLevel: number;
  toLevel: number;
  occurredAt: string;
};

/**
 * Returns up to 5 unacknowledged level-ups for the signed-in user.
 * The Postgres trigger inserts a level_ups row whenever an xp_event
 * crosses a threshold; the celebration banner reads them here and
 * marks them acknowledged so we never show the same level-up twice.
 */
export async function getUnacknowledgedLevelUps(): Promise<Result<LevelUpRow[]>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const { data } = await service
    .from('level_ups')
    .select('id, from_level, to_level, occurred_at')
    .eq('user_id', user.id)
    .eq('acknowledged', false)
    .order('occurred_at', { ascending: false })
    .limit(5);

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      fromLevel: r.from_level,
      toLevel: r.to_level,
      occurredAt: r.occurred_at,
    })),
  );
}

export async function acknowledgeLevelUp(levelUpId: number): Promise<Result<{ ok: true }>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  // Atomic update scoped to the user so a hostile id can't tick someone
  // else's record.
  const { error: updateErr } = await service
    .from('level_ups')
    .update({ acknowledged: true })
    .eq('id', levelUpId)
    .eq('user_id', user.id);

  if (updateErr) return err('persist_failed', updateErr.message);
  return ok({ ok: true });
}
