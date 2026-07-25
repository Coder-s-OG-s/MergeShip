'use server';

import { requireUser } from '@/lib/action-auth';
import { getDb, schema } from '@/lib/db/client';
import { eq, and, or, desc, ne, isNull } from 'drizzle-orm';
import { ok, err, type Result } from '@/lib/result';
import { revalidatePath } from 'next/cache';

// Helper to determine if levels are eligible for mentorship chat
export function validateMentorshipRelationship(
  levelA: number,
  levelB: number,
): {
  isValid: boolean;
  mentorLevel: number;
  menteeLevel: number;
} {
  const mentorLevel = Math.max(levelA, levelB);
  const menteeLevel = Math.min(levelA, levelB);

  // Mentor must be Level >= 2 and strictly greater than the mentee
  const isValid = mentorLevel >= 2 && mentorLevel > menteeLevel;
  return { isValid, mentorLevel, menteeLevel };
}

export async function getOrCreateChatChannel(
  otherUserId: string,
): Promise<Result<{ channelId: string }>> {
  const authRes = await requireUser();
  if (!authRes.ok) return authRes;
  const currentUser = authRes.data.user;

  if (currentUser.id === otherUserId) {
    return err('invalid_input', 'Cannot start a chat with yourself');
  }

  const db = getDb();

  // Fetch both profiles
  const [profileSelf] = await db
    .select({ id: schema.profiles.id, level: schema.profiles.level })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, currentUser.id))
    .limit(1);

  const [profileOther] = await db
    .select({ id: schema.profiles.id, level: schema.profiles.level })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, otherUserId))
    .limit(1);

  if (!profileSelf || !profileOther) {
    return err('not_found', 'User profile not found');
  }

  // Validate relationship eligibility
  const { isValid } = validateMentorshipRelationship(profileSelf.level, profileOther.level);

  if (!isValid) {
    return err(
      'not_authorised',
      `Mentorship chat is only allowed hierarchically (Level 2 guides Level 1, Level 3 guides Level 2). ` +
        `Self Level: ${profileSelf.level}, Target Level: ${profileOther.level}`,
    );
  }

  const mentorId = profileSelf.level > profileOther.level ? profileSelf.id : profileOther.id;
  const menteeId = profileSelf.level > profileOther.level ? profileOther.id : profileSelf.id;

  // Check if channel already exists
  const [existingChannel] = await db
    .select()
    .from(schema.chatChannels)
    .where(
      and(eq(schema.chatChannels.mentorId, mentorId), eq(schema.chatChannels.menteeId, menteeId)),
    )
    .limit(1);

  if (existingChannel) {
    return ok({ channelId: existingChannel.id });
  }

  // Create channel
  const [newChannel] = await db
    .insert(schema.chatChannels)
    .values({
      mentorId,
      menteeId,
    })
    .returning();

  if (!newChannel) {
    return err('persist_failed', 'Failed to create chat channel');
  }

  return ok({ channelId: newChannel.id });
}

export async function sendChatMessage(
  channelId: string,
  content: string,
): Promise<Result<{ messageId: number }>> {
  const authRes = await requireUser();
  if (!authRes.ok) return authRes;
  const currentUser = authRes.data.user;

  const db = getDb();

  // Validate user is part of the channel
  const [channel] = await db
    .select()
    .from(schema.chatChannels)
    .where(eq(schema.chatChannels.id, channelId))
    .limit(1);

  if (!channel) {
    return err('not_found', 'Chat channel not found');
  }

  if (channel.mentorId !== currentUser.id && channel.menteeId !== currentUser.id) {
    return err('not_authorised', 'You are not a participant in this chat channel');
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return err('invalid_input', 'Message content cannot be empty');
  }

  const [newMessage] = await db
    .insert(schema.chatMessages)
    .values({
      channelId,
      senderId: currentUser.id,
      content: trimmedContent,
    })
    .returning();

  if (!newMessage) {
    return err('persist_failed', 'Failed to save message');
  }

  // Update channel's updatedAt field
  await db
    .update(schema.chatChannels)
    .set({ updatedAt: new Date() })
    .where(eq(schema.chatChannels.id, channelId));

  return ok({ messageId: newMessage.id });
}

export async function markMessagesAsRead(channelId: string): Promise<Result<{ count: number }>> {
  const authRes = await requireUser();
  if (!authRes.ok) return authRes;
  const currentUser = authRes.data.user;

  const db = getDb();

  // Validate membership
  const [channel] = await db
    .select()
    .from(schema.chatChannels)
    .where(eq(schema.chatChannels.id, channelId))
    .limit(1);

  if (!channel) {
    return err('not_found', 'Chat channel not found');
  }

  if (channel.mentorId !== currentUser.id && channel.menteeId !== currentUser.id) {
    return err('not_authorised', 'You are not a participant in this chat channel');
  }

  // Update messages sent by the OTHER participant that haven't been read yet
  const updated = await db
    .update(schema.chatMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.chatMessages.channelId, channelId),
        ne(schema.chatMessages.senderId, currentUser.id),
        isNull(schema.chatMessages.readAt),
      ),
    )
    .returning();

  return ok({ count: updated.length });
}

export type ChatParticipantInfo = {
  id: string;
  githubHandle: string;
  avatarUrl: string | null;
  level: number;
};

export type ChatChannelWithParticipant = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  participant: ChatParticipantInfo;
  unreadCount: number;
  lastMessage: {
    content: string;
    createdAt: Date;
    senderId: string;
  } | null;
};

export async function getActiveChatChannels(): Promise<Result<ChatChannelWithParticipant[]>> {
  const authRes = await requireUser();
  if (!authRes.ok) return authRes;
  const currentUser = authRes.data.user;

  const db = getDb();

  // Fetch channels where current user is mentor or mentee
  const channels = await db
    .select()
    .from(schema.chatChannels)
    .where(
      or(
        eq(schema.chatChannels.mentorId, currentUser.id),
        eq(schema.chatChannels.menteeId, currentUser.id),
      ),
    )
    .orderBy(desc(schema.chatChannels.updatedAt));

  const result: ChatChannelWithParticipant[] = [];

  for (const c of channels) {
    const otherUserId = c.mentorId === currentUser.id ? c.menteeId : c.mentorId;

    const [otherProfile] = await db
      .select({
        id: schema.profiles.id,
        githubHandle: schema.profiles.githubHandle,
        avatarUrl: schema.profiles.avatarUrl,
        level: schema.profiles.level,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, otherUserId))
      .limit(1);

    if (!otherProfile) continue;

    // Fetch unread count for current user
    const unreadMessages = await db
      .select()
      .from(schema.chatMessages)
      .where(
        and(
          eq(schema.chatMessages.channelId, c.id),
          ne(schema.chatMessages.senderId, currentUser.id),
          isNull(schema.chatMessages.readAt),
        ),
      );

    // Fetch last message
    const [lastMsg] = await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.channelId, c.id))
      .orderBy(desc(schema.chatMessages.createdAt))
      .limit(1);

    result.push({
      id: c.id,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      participant: otherProfile,
      unreadCount: unreadMessages.length,
      lastMessage: lastMsg
        ? {
            content: lastMsg.content,
            createdAt: lastMsg.createdAt,
            senderId: lastMsg.senderId,
          }
        : null,
    });
  }

  return ok(result);
}

export type ChatMessageDetail = {
  id: number;
  channelId: string;
  senderId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
  sender: {
    githubHandle: string;
    avatarUrl: string | null;
  };
};

export async function getChatChannelMessages(
  channelId: string,
): Promise<Result<ChatMessageDetail[]>> {
  const authRes = await requireUser();
  if (!authRes.ok) return authRes;
  const currentUser = authRes.data.user;

  const db = getDb();

  // Validate membership
  const [channel] = await db
    .select()
    .from(schema.chatChannels)
    .where(eq(schema.chatChannels.id, channelId))
    .limit(1);

  if (!channel) {
    return err('not_found', 'Chat channel not found');
  }

  if (channel.mentorId !== currentUser.id && channel.menteeId !== currentUser.id) {
    return err('not_authorised', 'You are not a participant in this chat channel');
  }

  // Fetch messages
  const messages = await db
    .select({
      id: schema.chatMessages.id,
      channelId: schema.chatMessages.channelId,
      senderId: schema.chatMessages.senderId,
      content: schema.chatMessages.content,
      readAt: schema.chatMessages.readAt,
      createdAt: schema.chatMessages.createdAt,
      senderHandle: schema.profiles.githubHandle,
      senderAvatar: schema.profiles.avatarUrl,
    })
    .from(schema.chatMessages)
    .innerJoin(schema.profiles, eq(schema.chatMessages.senderId, schema.profiles.id))
    .where(eq(schema.chatMessages.channelId, channelId))
    .orderBy(schema.chatMessages.createdAt);

  const formatted: ChatMessageDetail[] = messages.map((m) => ({
    id: m.id,
    channelId: m.channelId,
    senderId: m.senderId,
    content: m.content,
    readAt: m.readAt,
    createdAt: m.createdAt,
    sender: {
      githubHandle: m.senderHandle,
      avatarUrl: m.senderAvatar,
    },
  }));

  return ok(formatted);
}
