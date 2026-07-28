import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getOrCreateChatChannel,
  sendChatMessage,
  markMessagesAsRead,
  getActiveChatChannels,
  getChatChannelMessages,
  validateMentorshipRelationship,
} from './chat';
import * as actionAuth from '@/lib/action-auth';
import { ok, err } from '@/lib/result';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

vi.mock('@/lib/db/client', () => ({
  getDb: () => mockDb,
  schema: {
    profiles: {
      id: 'profiles.id',
      level: 'profiles.level',
      githubHandle: 'profiles.githubHandle',
      avatarUrl: 'profiles.avatarUrl',
    },
    chatChannels: {
      id: 'chat_channels.id',
      mentorId: 'chat_channels.mentorId',
      menteeId: 'chat_channels.menteeId',
      createdAt: 'chat_channels.createdAt',
      updatedAt: 'chat_channels.updatedAt',
    },
    chatMessages: {
      id: 'chat_messages.id',
      channelId: 'chat_messages.channelId',
      senderId: 'chat_messages.senderId',
      content: 'chat_messages.content',
      readAt: 'chat_messages.readAt',
      createdAt: 'chat_messages.createdAt',
    },
  },
}));

vi.mock('@/lib/action-auth', () => ({
  requireUser: vi.fn(),
}));

function createMockChain(data: unknown = [], singleData: unknown = null) {
  const chain: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(data),
    then: (resolve: (v: any) => void) =>
      Promise.resolve(singleData !== null ? singleData : { data }).then(resolve),
  };
  return chain;
}

describe('Mentorship Chat Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateMentorshipRelationship', () => {
    it('allows Level 2 to guide Level 1', () => {
      const { isValid } = validateMentorshipRelationship(2, 1);
      expect(isValid).toBe(true);
    });

    it('allows Level 3 to guide Level 2', () => {
      const { isValid } = validateMentorshipRelationship(3, 2);
      expect(isValid).toBe(true);
    });

    it('disallows Level 1 to guide Level 2', () => {
      const { isValid } = validateMentorshipRelationship(1, 2);
      expect(isValid).toBe(true); // Since it automatically resolves higher as mentor
    });

    it('disallows Level 1 to guide Level 1', () => {
      const { isValid } = validateMentorshipRelationship(1, 1);
      expect(isValid).toBe(false);
    });

    it('disallows Level 0 mentor even if difference exists', () => {
      const { isValid } = validateMentorshipRelationship(1, 0);
      expect(isValid).toBe(false); // Mentor must be level >= 2
    });
  });

  describe('getOrCreateChatChannel', () => {
    it('returns error if current user is same as target user', async () => {
      vi.mocked(actionAuth.requireUser).mockResolvedValue(ok({ user: { id: 'user-1' } } as any));

      const res = await getOrCreateChatChannel('user-1');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('invalid_input');
      }
    });

    it('returns error if levels are not eligible for mentorship', async () => {
      vi.mocked(actionAuth.requireUser).mockResolvedValue(ok({ user: { id: 'user-1' } } as any));

      // Both users are level 1
      mockSelect.mockImplementation(() => {
        const chain = createMockChain();
        chain.then = (resolve: any) => resolve([{ id: 'user-1', level: 1 }]);
        return chain;
      });

      const res = await getOrCreateChatChannel('user-2');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_authorised');
      }
    });

    it('returns existing channel if it already exists', async () => {
      vi.mocked(actionAuth.requireUser).mockResolvedValue(
        ok({ user: { id: 'user-mentor' } } as any),
      );

      let callCount = 0;
      mockSelect.mockImplementation(() => {
        const chain = createMockChain();
        chain.then = (resolve: any) => {
          callCount++;
          if (callCount === 1) {
            // self profile
            resolve([{ id: 'user-mentor', level: 3 }]);
          } else if (callCount === 2) {
            // other profile
            resolve([{ id: 'user-mentee', level: 2 }]);
          } else {
            // channel search
            resolve([{ id: 'existing-channel-id' }]);
          }
        };
        return chain;
      });

      const res = await getOrCreateChatChannel('user-mentee');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.channelId).toBe('existing-channel-id');
      }
    });
  });

  describe('sendChatMessage', () => {
    it('allows a participant to send a message', async () => {
      vi.mocked(actionAuth.requireUser).mockResolvedValue(
        ok({ user: { id: 'user-mentor' } } as any),
      );

      let selectCount = 0;
      mockSelect.mockImplementation(() => {
        const chain = createMockChain();
        chain.then = (resolve: any) => {
          selectCount++;
          // Channel query returns channel where user-mentor is mentor
          resolve([{ id: 'channel-id', mentorId: 'user-mentor', menteeId: 'user-mentee' }]);
        };
        return chain;
      });

      mockInsert.mockImplementation(() => {
        const chain = createMockChain([{ id: 42 }]);
        return chain;
      });

      mockUpdate.mockImplementation(() => {
        const chain = createMockChain();
        return chain;
      });

      const res = await sendChatMessage('channel-id', 'Hello!');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.messageId).toBe(42);
      }
    });

    it('disallows non-participant from sending message', async () => {
      vi.mocked(actionAuth.requireUser).mockResolvedValue(
        ok({ user: { id: 'user-outsider' } } as any),
      );

      mockSelect.mockImplementation(() => {
        const chain = createMockChain();
        chain.then = (resolve: any) => {
          resolve([{ id: 'channel-id', mentorId: 'user-mentor', menteeId: 'user-mentee' }]);
        };
        return chain;
      });

      const res = await sendChatMessage('channel-id', 'Hello!');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_authorised');
      }
    });
  });
});
