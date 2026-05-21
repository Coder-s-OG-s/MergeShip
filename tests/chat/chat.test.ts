import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/lib/db/client', () => ({
  getDb: () => ({
    insert: mockInsert,
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  }),
}));

vi.mock('@/inngest/client', () => ({
  inngest: {
    send: mockSend,
  },
}));

const { createMentorshipSession, appendMentorshipMessage } = await import('@/lib/chat');

describe('mentorship chat helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReset();
    mockInsert.mockImplementation(() => ({
      values: () => ({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 1, mentorId: 'mentor-id', menteeId: 'mentee-id', level: 1 }]),
      }),
    }));
  });

  it('creates a mentorship session and emits an event', async () => {
    mockInsert.mockImplementationOnce(() => ({
      values: () => ({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 42, mentorId: 'mentor-id', menteeId: 'mentee-id', level: 1 }]),
      }),
    }));

    const session = await createMentorshipSession({ mentorId: 'mentor-id', menteeId: 'mentee-id' });
    expect(session.id).toBe(42);
    expect(mockSend).toHaveBeenCalledWith({
      name: 'mentorship.session.created',
      data: expect.objectContaining({
        sessionId: 42,
        mentorId: 'mentor-id',
        menteeId: 'mentee-id',
      }),
    });
  });

  it('appends a mentorship message and emits a message event', async () => {
    mockInsert.mockImplementationOnce(() => ({
      values: () => ({
        returning: vi
          .fn()
          .mockResolvedValue([
            {
              id: 88,
              sessionId: 42,
              senderId: 'mentor-id',
              content: 'Hello',
              readStatus: 'unread',
            },
          ]),
      }),
    }));

    const message = await appendMentorshipMessage({
      sessionId: 42,
      senderId: 'mentor-id',
      content: 'Hello',
    });
    expect(message.id).toBe(88);
    expect(mockSend).toHaveBeenCalledWith({
      name: 'mentorship.message.sent',
      data: expect.objectContaining({
        sessionId: 42,
        senderId: 'mentor-id',
        messageId: 88,
        content: 'Hello',
      }),
    });
  });
});
