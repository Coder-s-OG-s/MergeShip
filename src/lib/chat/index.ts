import { getDb } from '@/lib/db/client';
import { mentorshipSessions, messages } from '@/lib/db/schema';
import { inngest } from '@/inngest/client';
import { eq, isNull, or, and } from 'drizzle-orm';

export type MentorshipSessionRow = {
  id: number;
  mentor_id: string;
  mentee_id: string;
  level: number;
  started_at: string;
  ended_at: string | null;
};

export type MentorshipMessageRow = {
  id: number;
  session_id: number;
  sender_id: string;
  content: string;
  timestamp: string;
  read_status: 'unread' | 'read';
};

export async function createMentorshipSession(args: {
  mentorId: string;
  menteeId: string;
  level?: number;
}) {
  const db = getDb();
  const [session] = await db
    .insert(mentorshipSessions)
    .values({
      mentorId: args.mentorId,
      menteeId: args.menteeId,
      level: args.level ?? 1,
    })
    .returning();

  if (!session) throw new Error('Failed to create mentorship session');

  await inngest.send({
    name: 'mentorship.session.created',
    data: {
      sessionId: session.id,
      mentorId: args.mentorId,
      menteeId: args.menteeId,
      level: session.level,
    },
  });

  return session;
}

export async function endMentorshipSession(sessionId: number) {
  const db = getDb();
  const [session] = await db
    .update(mentorshipSessions)
    .set({ endedAt: new Date() })
    .where(eq(mentorshipSessions.id, sessionId))
    .returning();

  if (!session) throw new Error('Failed to end mentorship session');

  await inngest.send({
    name: 'mentorship.session.ended',
    data: {
      sessionId: session.id,
      mentorId: session.mentorId,
      menteeId: session.menteeId,
      endedAt: session.endedAt,
    },
  });

  return session;
}

export async function appendMentorshipMessage(args: {
  sessionId: number;
  senderId: string;
  content: string;
}) {
  const db = getDb();
  const [message] = await db
    .insert(messages)
    .values({
      sessionId: args.sessionId,
      senderId: args.senderId,
      content: args.content,
      readStatus: 'unread',
    })
    .returning();

  if (!message) throw new Error('Failed to create message');

  await inngest.send({
    name: 'mentorship.message.sent',
    data: {
      sessionId: message.sessionId,
      senderId: message.senderId,
      messageId: message.id,
      content: message.content,
    },
  });

  return message;
}

export async function getMentorshipSessionById(sessionId: number) {
  const db = getDb();
  const results = await db
    .select()
    .from(mentorshipSessions)
    .where(eq(mentorshipSessions.id, sessionId))
    .limit(1);
  return results[0] ?? null;
}

export async function listActiveMentorshipSessionsForUser(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(mentorshipSessions)
    .where(
      and(
        isNull(mentorshipSessions.endedAt),
        or(eq(mentorshipSessions.mentorId, userId), eq(mentorshipSessions.menteeId, userId)),
      ),
    );
}
