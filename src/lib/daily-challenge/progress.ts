import { getDb, schema } from '../db/client';
import { eq, and, sql } from 'drizzle-orm';
import { insertXpEvent } from '../xp/events';

export async function getActiveChallenge(db: any) {
  // 1. Fetch all challenge templates ordered by ID
  const templates = await db
    .select()
    .from(schema.dailyChallenges)
    .orderBy(schema.dailyChallenges.id);

  if (templates.length === 0) {
    return null;
  }

  // 2. Select one deterministically based on UTC day
  const utcDay = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return templates[utcDay % templates.length];
}

export async function incrementChallengeProgress(args: {
  userId: string;
  type: 'pr_opened' | 'issue_comment' | 'review_submitted';
}) {
  const db = getDb();

  // Find the active challenge for today
  const challenge = await getActiveChallenge(db);
  if (!challenge || challenge.type !== args.type) {
    return { skipped: true, reason: 'no_matching_challenge' };
  }

  const todayDateStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  // Atomically increment the progress count in user_challenge_progress table
  await db.transaction(async (tx) => {
    // Upsert the progress
    const res = await tx
      .insert(schema.userChallengeProgress)
      .values({
        userId: args.userId,
        date: todayDateStr,
        challengeId: challenge.id,
        current: 1,
        completed: false,
      })
      .onConflictDoUpdate({
        target: [schema.userChallengeProgress.userId, schema.userChallengeProgress.date],
        set: {
          current: sql`${schema.userChallengeProgress.current} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    const progress = res[0];
    if (!progress) {
      throw new Error('failed_to_upsert_progress');
    }

    // Check if goal met and not already completed
    if (progress.current >= challenge.goal && !progress.completed) {
      // Mark as completed
      await tx
        .update(schema.userChallengeProgress)
        .set({ completed: true, updatedAt: new Date() })
        .where(
          and(
            eq(schema.userChallengeProgress.userId, args.userId),
            eq(schema.userChallengeProgress.date, todayDateStr),
          ),
        );

      // Award XP!
      // Idempotency: refId is 'daily_challenge:{challengeId}:{date}'
      await insertXpEvent({
        userId: args.userId,
        source: 'daily_challenge',
        refType: 'daily_challenge',
        refId: `daily_challenge:${challenge.id}:${todayDateStr}`,
        xpDelta: challenge.xpReward,
        metadata: { challengeId: challenge.id, date: todayDateStr },
      });
    }
  });

  return { ok: true };
}
