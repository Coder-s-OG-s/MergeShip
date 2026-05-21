import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RLS migrations', () => {
  it('keeps the failed_webhook_events RLS migration statement intact', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/0013_failed_webhook_events_rls.sql'),
      'utf8',
    );

    expect(migration.toLowerCase()).toMatch(
      /alter table(?: if exists)? failed_webhook_events enable row level security/,
    );
  });
});
