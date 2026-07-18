import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processMembershipEvent, processMemberEvent } from './process-membership-events';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
const mockSend = vi.fn();
vi.mock('../client', () => ({
  inngest: {
    createFunction: (_c: unknown, _t: unknown, h: Function) => h,
    send: (...args: unknown[]) => mockSend(...args),
  },
}));

const runMembership = processMembershipEvent as unknown as (ctx: {
  event: { data: { payload: Record<string, unknown> } };
  step: typeof step;
}) => Promise<unknown>;

const runMember = processMemberEvent as unknown as (ctx: {
  event: { data: { payload: Record<string, unknown> } };
  step: typeof step;
}) => Promise<unknown>;

describe('processMembershipEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processMembershipEvent (Org)', () => {
    it('triggers maintainer discover for added org member', async () => {
      wire({
        profiles: sb({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'u1', github_handle: 'alice' },
          }),
        }),
      });

      const event = {
        data: {
          payload: { action: 'added', member: { login: 'alice' } },
        },
      };

      const result = await runMembership({ event, step });

      expect(mockSend).toHaveBeenCalledWith({
        name: 'maintainer/discover',
        data: { userId: 'u1', githubHandle: 'alice', force: true },
      });
      expect(result).toEqual({ ok: true, action: 'added' });
    });

    it('skips if member is not a MergeShip user', async () => {
      wire({
        profiles: sb({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      });

      const event = {
        data: {
          payload: { action: 'added', member: { login: 'alice' } },
        },
      };

      const result = await runMembership({ event, step });
      expect(mockSend).not.toHaveBeenCalled();
      expect(result).toEqual({ skipped: true, reason: 'not_a_user' });
    });
  });

  describe('processMemberEvent (Repo Collaborator)', () => {
    it('triggers maintainer discover for repo collaborator', async () => {
      wire({
        installation_repositories: sb({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { repo_full_name: 'test-org/repo-1' },
          }),
        }),
        profiles: sb({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'u1', github_handle: 'alice' },
          }),
        }),
      });

      const event = {
        data: {
          payload: {
            action: 'added',
            member: { login: 'alice' },
            repository: { full_name: 'test-org/repo-1' },
          },
        },
      };

      const result = await runMember({ event, step });

      expect(mockSend).toHaveBeenCalledWith({
        name: 'maintainer/discover',
        data: { userId: 'u1', githubHandle: 'alice', force: true },
      });
      expect(result).toEqual({ ok: true, action: 'added' });
    });

    it('skips if repository is not part of any installation', async () => {
      wire({
        installation_repositories: sb({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      });

      const event = {
        data: {
          payload: {
            action: 'added',
            member: { login: 'alice' },
            repository: { full_name: 'test-org/repo-unknown' },
          },
        },
      };

      const result = await runMember({ event, step });
      expect(mockSend).not.toHaveBeenCalled();
      expect(result).toEqual({ skipped: true, reason: 'repo_not_in_install' });
    });
  });
});
