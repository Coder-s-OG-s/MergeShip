/**
 * Seeds the local Supabase Postgres with synthetic personas and realistic
 * xp_events history. Runs against the local stack (supabase start).
 *
 * Usage: pnpm db:seed
 *
 * Personas: Alice L0, Bob L1, Carol L2, Dave L3, Eve L4, Frank maintainer.
 * All passwords: 'dev-password-only'.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY required. Run: supabase status to find it.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEV_PASSWORD = 'dev-password-only';

type Persona = {
  email: string;
  handle: string;
  displayName: string;
  role: 'contributor' | 'maintainer' | 'both';
  primaryLanguage: string;
  // total XP to seed via xp_events so the trigger recomputes level cleanly
  seedXp: number;
};

const PERSONAS: Persona[] = [
  {
    email: 'alice@test.local',
    handle: 'alice',
    displayName: 'Alice',
    role: 'contributor',
    primaryLanguage: 'TypeScript',
    seedXp: 0,
  },
  {
    email: 'bob@test.local',
    handle: 'bob',
    displayName: 'Bob',
    role: 'contributor',
    primaryLanguage: 'Python',
    seedXp: 200,
  },
  {
    email: 'carol@test.local',
    handle: 'carol',
    displayName: 'Carol',
    role: 'contributor',
    primaryLanguage: 'Go',
    seedXp: 600,
  },
  {
    email: 'dave@test.local',
    handle: 'dave',
    displayName: 'Dave',
    role: 'both',
    primaryLanguage: 'TypeScript',
    seedXp: 1400,
  },
  {
    email: 'eve@test.local',
    handle: 'eve',
    displayName: 'Eve',
    role: 'both',
    primaryLanguage: 'Rust',
    seedXp: 2300,
  },
  {
    email: 'frank@test.local',
    handle: 'frank-mtnr',
    displayName: 'Frank',
    role: 'maintainer',
    primaryLanguage: 'TypeScript',
    seedXp: 1800,
  },
];

async function ensureUser(email: string): Promise<string> {
  // Try create; if exists, list to fetch id.
  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
  });

  if (!error && created?.user) return created.user.id;

  // Fetch existing
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users.find((u) => u.email === email);
  if (!existing) throw new Error(`could not create or find ${email}: ${error?.message}`);
  return existing.id;
}

async function seedPersona(p: Persona): Promise<void> {
  const userId = await ensureUser(p.email);

  await sb.from('profiles').upsert({
    id: userId,
    github_id: `seed:${p.handle}`,
    github_handle: p.handle,
    display_name: p.displayName,
    avatar_url: `https://i.pravatar.cc/150?u=${p.handle}`,
    role: p.role,
    primary_language: p.primaryLanguage,
    audit_completed: p.seedXp > 0,
  });

  // Seed a fake install so the install gate passes.
  const installationId = 1_000_000 + Math.abs(hashCode(p.handle));
  await sb.from('github_installations').upsert({
    id: installationId,
    user_id: userId,
    account_login: p.handle,
    account_type: 'User',
    repository_selection: 'all',
  });

  // Maintainer personas also need a junction row so isUserMaintainer() returns
  // true and /maintainer doesn't 307 them back to /dashboard. Same install id
  // they own → org_admin permission so they see every repo on it.
  if (p.role === 'maintainer' || p.role === 'both') {
    await sb.from('github_installation_users').upsert({
      installation_id: installationId,
      user_id: userId,
      permission_level: 'org_admin',
      source: 'install_creator',
    });
  }

  if (p.seedXp > 0) {
    // One audit event — trigger recomputes xp + level + inserts level_ups as needed.
    await sb.from('xp_events').upsert(
      {
        user_id: userId,
        source: 'github_audit',
        ref_id: `audit:seed:${p.handle}`,
        xp_delta: p.seedXp,
        metadata: { synthetic: true } as never,
      },
      { onConflict: 'user_id,source,ref_id' },
    );
  }

  console.warn(`  seeded ${p.displayName} (${p.email}) -> ${p.seedXp} XP`);
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}

async function main(): Promise<void> {
  console.warn('Seeding MergeShip dev personas...');
  for (const p of PERSONAS) {
    await seedPersona(p);
  }
  console.warn(
    'Done. Sign in at /dev/login with any persona email + password "dev-password-only".',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
