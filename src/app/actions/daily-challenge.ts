'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getDb, schema } from '@/lib/db/client';
import { getActiveChallenge } from '@/lib/daily-challenge/progress';
import { rateLimit, RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { ok, err, type Result } from '@/lib/result';
import { eq, and } from 'drizzle-orm';

export type DailyChallengeData = {
  title: string;
  description: string;
  goal: number;
  current: number;
  xpReward: number;
  completed: boolean;
};

export async function getDailyChallenge(): Promise<Result<DailyChallengeData>> {
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const rateRes = await rateLimit({
    namespace: 'daily-challenge:get',
    key: user.id,
    ...RATE_LIMIT_TIERS.GENEROUS,
  });
  if (!rateRes.ok) return err('rate_limited', 'too many requests', true);

  const db = getDb();
  const challenge = await getActiveChallenge(db);
  if (!challenge) {
    return err('not_found', 'no active daily challenges');
  }

  const todayDateStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  // Query user_challenge_progress for the user's progress on this day
  const [progress] = await db
    .select()
    .from(schema.userChallengeProgress)
    .where(
      and(
        eq(schema.userChallengeProgress.userId, user.id),
        eq(schema.userChallengeProgress.date, todayDateStr),
      ),
    )
    .limit(1);

  return ok({
    title: challenge.title,
    description: challenge.description,
    goal: challenge.goal,
    current: progress?.current ?? 0,
    xpReward: challenge.xpReward,
    completed: progress?.completed ?? false,
  });
}
