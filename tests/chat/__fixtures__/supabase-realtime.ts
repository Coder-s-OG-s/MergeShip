import { vi } from 'vitest';

export const mockSupabaseRealtimeChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockResolvedValue({}),
  unsubscribe: vi.fn().mockResolvedValue({}),
  track: vi.fn().mockResolvedValue({}),
  presenceState: vi.fn().mockReturnValue({}),
};

export const mockBrowserSupabase = {
  channel: vi.fn(() => mockSupabaseRealtimeChannel),
};
