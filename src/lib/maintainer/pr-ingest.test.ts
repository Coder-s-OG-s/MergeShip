import { describe, it, expect } from 'vitest';
import { derivePrState, isWithinBackfillWindow, buildPrRow, type IngestiblePr } from './pr-ingest';

describe('derivePrState', () => {
  it('closed + merged → merged', () => {
    expect(
      derivePrState(
        { state: 'closed', merged: true, merged_at: '2026-05-01T00:00:00Z' } as never,
        'closed',
      ),
    ).toBe('merged');
  });

  it('closed + not merged → closed', () => {
    expect(
      derivePrState({ state: 'closed', merged: false, merged_at: null } as never, 'closed'),
    ).toBe('closed');
  });

  it('opened action → open', () => {
    expect(
      derivePrState({ state: 'open', merged: false, merged_at: null } as never, 'opened'),
    ).toBe('open');
  });

  it('synchronize + state=open → open', () => {
    expect(
      derivePrState({ state: 'open', merged: false, merged_at: null } as never, 'synchronize'),
    ).toBe('open');
  });

  it('synchronize + state=closed (PR was merged earlier) → merged', () => {
    expect(
      derivePrState(
        { state: 'closed', merged: true, merged_at: '2026-05-01T00:00:00Z' } as never,
        'synchronize',
      ),
    ).toBe('merged');
  });

  it('edited + state=closed + has merged_at → merged', () => {
    expect(
      derivePrState(
        { state: 'closed', merged: false, merged_at: '2026-05-01T00:00:00Z' } as never,
        'edited',
      ),
    ).toBe('merged');
  });

  it('reopened → open', () => {
    expect(
      derivePrState({ state: 'open', merged: false, merged_at: null } as never, 'reopened'),
    ).toBe('open');
  });
});

describe('isWithinBackfillWindow', () => {
  const now = new Date('2026-05-14T00:00:00Z').getTime();

  it('within 30 days → true', () => {
    expect(isWithinBackfillWindow('2026-05-01T00:00:00Z', now, 30)).toBe(true);
    expect(isWithinBackfillWindow('2026-04-15T00:00:00Z', now, 30)).toBe(true);
  });

  it('older than window → false', () => {
    expect(isWithinBackfillWindow('2026-03-01T00:00:00Z', now, 30)).toBe(false);
  });

  it('exactly at window edge → true (inclusive)', () => {
    const exact = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
    expect(isWithinBackfillWindow(exact, now, 30)).toBe(true);
  });

  it('garbage date returns false', () => {
    expect(isWithinBackfillWindow('not a date', now, 30)).toBe(false);
  });
});

describe('buildPrRow', () => {
  const base: IngestiblePr = {
    id: 999,
    number: 12,
    html_url: 'https://github.com/acme/api/pull/12',
    title: 'Fix bug',
    body: 'Closes #5',
    state: 'open',
    draft: false,
    merged: false,
    merged_at: null,
    closed_at: null,
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-11T00:00:00Z',
    user: { login: 'alice' },
    base: { repo: { full_name: 'acme/api' } },
  };

  it('builds a row with all fields populated for an opened PR', () => {
    const row = buildPrRow(base, 'profile-uuid', 'opened');
    expect(row.github_pr_id).toBe(999);
    expect(row.repo_full_name).toBe('acme/api');
    expect(row.number).toBe(12);
    expect(row.author_login).toBe('alice');
    expect(row.author_user_id).toBe('profile-uuid');
    expect(row.state).toBe('open');
    expect(row.url).toBe('https://github.com/acme/api/pull/12');
    expect(row.body_excerpt).toBe('Closes #5');
  });

  it('passes through null author_user_id for non-MergeShip authors', () => {
    const row = buildPrRow(base, null, 'opened');
    expect(row.author_user_id).toBeNull();
  });

  it('truncates body to 500 chars', () => {
    const long = { ...base, body: 'a'.repeat(2000) };
    const row = buildPrRow(long, null, 'opened');
    expect(row.body_excerpt!.length).toBe(500);
  });

  it('returns null body_excerpt when body is empty', () => {
    const row = buildPrRow({ ...base, body: '' }, null, 'opened');
    expect(row.body_excerpt).toBeNull();
  });

  it('maps merged state correctly on closed action', () => {
    const merged = {
      ...base,
      state: 'closed' as const,
      merged: true,
      merged_at: '2026-05-12T00:00:00Z',
    };
    expect(buildPrRow(merged, null, 'closed').state).toBe('merged');
  });
});
