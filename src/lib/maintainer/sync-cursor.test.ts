import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSyncCursor, setSyncCursor, clearSyncCursor } from './sync-cursor';
import * as supabaseService from '@/lib/supabase/service';

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: vi.fn(),
}));

describe('sync-cursor', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ data: null, error: null })),
    };
    vi.mocked(supabaseService.getServiceSupabase).mockReturnValue(mockSupabase);
  });

  it('getSyncCursor returns page when data exists', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: { page: 5 }, error: null });
    const page = await getSyncCursor(123, 'test/repo', 'pull_requests');
    expect(page).toBe(5);
    expect(mockSupabase.from).toHaveBeenCalledWith('repo_sync_cursors');
    expect(mockSupabase.select).toHaveBeenCalledWith('page');
    expect(mockSupabase.eq).toHaveBeenCalledWith('installation_id', 123);
  });

  it('getSyncCursor returns null when no data', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    const page = await getSyncCursor(123, 'test/repo', 'pull_requests');
    expect(page).toBeNull();
  });

  it('setSyncCursor upserts page', async () => {
    mockSupabase.upsert.mockResolvedValue({ data: null, error: null });
    await setSyncCursor(123, 'test/repo', 'pull_requests', 6);
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        installation_id: 123,
        repo_full_name: 'test/repo',
        sync_type: 'pull_requests',
        page: 6,
      }),
      { onConflict: 'installation_id,repo_full_name,sync_type' },
    );
  });

  it('clearSyncCursor deletes the cursor', async () => {
    await clearSyncCursor(123, 'test/repo', 'pull_requests');
    expect(mockSupabase.delete).toHaveBeenCalled();
    expect(mockSupabase.eq).toHaveBeenCalledWith('installation_id', 123);
    expect(mockSupabase.eq).toHaveBeenCalledWith('repo_full_name', 'test/repo');
    expect(mockSupabase.eq).toHaveBeenCalledWith('sync_type', 'pull_requests');
  });
});
