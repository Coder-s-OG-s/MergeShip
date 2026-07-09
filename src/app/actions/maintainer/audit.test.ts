import { vi, describe, it, expect, beforeEach } from 'vitest';
import { logMaintainerAction } from './audit';

const mockDb = {
  query: {
    profiles: {
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn(),
};

vi.mock('@/lib/db/client', () => ({
  tryGetDb: () => mockDb,
}));

describe('logMaintainerAction', () => {
  let mockInsert: any;
  let mockValues: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockValues = vi.fn().mockResolvedValue({});
    mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    (mockDb.insert as any) = mockInsert;

    (mockDb.query.profiles.findFirst as any).mockResolvedValue({
      githubHandle: 'testuser',
      displayName: 'Test User',
      role: 'maintainer',
    });
  });

  it('successfully logs an action and captures actor snapshot', async () => {
    await logMaintainerAction({
      actorUserId: 'user-123',
      installationId: 1,
      action: 'test_action',
      targetType: 'test_target',
      targetId: 'target-123',
      oldValues: { foo: 'bar' },
      newValues: { foo: 'baz' },
    });

    expect(mockDb.query.profiles.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
        columns: { githubHandle: true, displayName: true, role: true },
      }),
    );

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-123',
        actorSnapshot: {
          githubHandle: 'testuser',
          displayName: 'Test User',
          role: 'maintainer',
        },
        installationId: 1,
        action: 'test_action',
        targetType: 'test_target',
        targetId: 'target-123',
        status: 'success',
        errorMessage: null,
        oldValues: { foo: 'bar' },
        newValues: { foo: 'baz' },
      }),
    );
  });

  it('successfully logs a failed action with error message', async () => {
    await logMaintainerAction({
      actorUserId: 'user-123',
      installationId: 1,
      action: 'test_action',
      targetType: 'test_target',
      targetId: 'target-123',
      status: 'failed',
      errorMessage: 'Something went wrong',
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'Something went wrong',
      }),
    );
  });

  it('swallows errors when database insert fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockValues.mockRejectedValue(new Error('DB Insert failed'));

    // Should not throw
    await expect(
      logMaintainerAction({
        actorUserId: 'user-123',
        action: 'test_action',
        targetType: 'test_target',
        targetId: 'target-123',
      }),
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Maintainer Audit] Failed to write maintainer audit log',
      expect.any(Object),
    );

    consoleErrorSpy.mockRestore();
  });

  it('stores actor snapshot correctly if actorUserId is provided but user is deleted (returns null)', async () => {
    // simulate user not found
    (mockDb.query.profiles.findFirst as any).mockResolvedValue(null);

    await logMaintainerAction({
      actorUserId: 'user-123',
      action: 'test_action',
      targetType: 'test_target',
      targetId: 'target-123',
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actorSnapshot: null,
      }),
    );
  });
});
