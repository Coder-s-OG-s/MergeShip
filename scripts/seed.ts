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
  userIdByHandle.set(p.handle, userId);

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

// ----------------------------------------------------------------------------
// Demo data: synthetic issues, recommendations, PRs, reviews, help requests so
// every persona's dashboard reflects a realistic snapshot of the deployed app.
// Repo names use a `demo/` prefix so it's obvious nothing here is real.
// ----------------------------------------------------------------------------

const DEMO_REPOS = [
  { name: 'demo/eclipse-cli', language: 'TypeScript', health: 88 },
  { name: 'demo/notebook-rs', language: 'Rust', health: 82 },
  { name: 'demo/voyager-api', language: 'Python', health: 75 },
  { name: 'demo/quark-ui', language: 'TypeScript', health: 91 },
  { name: 'demo/lattice-search', language: 'Go', health: 70 },
];

type IssueSeed = {
  repo: string;
  number: number;
  title: string;
  difficulty: 'E' | 'M' | 'H';
  labels: string[];
};

const XP_BY_DIFFICULTY = { E: 50, M: 150, H: 400 } as const;

const ISSUES: IssueSeed[] = [
  // demo/eclipse-cli
  {
    repo: 'demo/eclipse-cli',
    number: 101,
    title: 'Improve --help output formatting',
    difficulty: 'E',
    labels: ['good first issue', 'docs'],
  },
  {
    repo: 'demo/eclipse-cli',
    number: 102,
    title: 'Add --version flag with build SHA',
    difficulty: 'E',
    labels: ['good first issue'],
  },
  {
    repo: 'demo/eclipse-cli',
    number: 103,
    title: 'Refactor config loader to accept TOML',
    difficulty: 'M',
    labels: ['help wanted', 'enhancement'],
  },
  {
    repo: 'demo/eclipse-cli',
    number: 104,
    title: 'Plugin architecture for custom commands',
    difficulty: 'H',
    labels: ['help wanted', 'complex'],
  },
  // demo/notebook-rs
  {
    repo: 'demo/notebook-rs',
    number: 211,
    title: 'Typo in README install section',
    difficulty: 'E',
    labels: ['good first issue', 'docs'],
  },
  {
    repo: 'demo/notebook-rs',
    number: 212,
    title: 'Add Default impl for Notebook struct',
    difficulty: 'E',
    labels: ['good first issue'],
  },
  {
    repo: 'demo/notebook-rs',
    number: 213,
    title: 'Stream cells lazily for large files',
    difficulty: 'M',
    labels: ['help wanted', 'performance'],
  },
  {
    repo: 'demo/notebook-rs',
    number: 214,
    title: 'Migrate sync IO to tokio',
    difficulty: 'H',
    labels: ['help wanted', 'complex'],
  },
  // demo/voyager-api
  {
    repo: 'demo/voyager-api',
    number: 321,
    title: 'Document /healthz endpoint',
    difficulty: 'E',
    labels: ['good first issue', 'docs'],
  },
  {
    repo: 'demo/voyager-api',
    number: 322,
    title: 'Validate query params on /search',
    difficulty: 'M',
    labels: ['help wanted', 'bug'],
  },
  {
    repo: 'demo/voyager-api',
    number: 323,
    title: 'Add OpenAPI schema autogen',
    difficulty: 'H',
    labels: ['help wanted', 'complex'],
  },
  // demo/quark-ui
  {
    repo: 'demo/quark-ui',
    number: 431,
    title: 'Fix Button focus ring contrast',
    difficulty: 'E',
    labels: ['good first issue', 'a11y'],
  },
  {
    repo: 'demo/quark-ui',
    number: 432,
    title: 'Add Tooltip primitive',
    difficulty: 'M',
    labels: ['help wanted'],
  },
  {
    repo: 'demo/quark-ui',
    number: 433,
    title: 'Theming via CSS variables',
    difficulty: 'M',
    labels: ['help wanted'],
  },
  {
    repo: 'demo/quark-ui',
    number: 434,
    title: 'Audit ARIA on every primitive',
    difficulty: 'H',
    labels: ['help wanted', 'complex', 'a11y'],
  },
  // demo/lattice-search
  {
    repo: 'demo/lattice-search',
    number: 541,
    title: 'Spelling in benchmark output',
    difficulty: 'E',
    labels: ['good first issue'],
  },
  {
    repo: 'demo/lattice-search',
    number: 542,
    title: 'Support fuzzy match scoring',
    difficulty: 'M',
    labels: ['help wanted'],
  },
  {
    repo: 'demo/lattice-search',
    number: 543,
    title: 'Replace ad-hoc index with HNSW',
    difficulty: 'H',
    labels: ['help wanted', 'complex'],
  },
];

// Look-up by persona handle → user id, populated after seedPersona runs.
const userIdByHandle = new Map<string, string>();
const issueIdByKey = new Map<string, number>(); // key: `${repo}#${number}`

async function seedDemoIssues(): Promise<void> {
  for (const i of ISSUES) {
    const repoMeta = DEMO_REPOS.find((r) => r.name === i.repo)!;
    const url = `https://github.com/${i.repo}/issues/${i.number}`;
    const { data } = await sb
      .from('issues')
      .upsert(
        {
          repo_full_name: i.repo,
          github_issue_number: i.number,
          title: i.title,
          body_excerpt: `Synthetic demo issue. ${i.title}`,
          difficulty: i.difficulty,
          difficulty_source: 'label',
          xp_reward: XP_BY_DIFFICULTY[i.difficulty],
          labels: i.labels,
          state: 'open',
          url,
          repo_health_score: repoMeta.health,
          repo_language: repoMeta.language,
          scored_at: new Date().toISOString(),
          author_login: 'frank-mtnr',
          comments_count: 0,
          github_created_at: daysAgo(14).toISOString(),
          github_updated_at: daysAgo(2).toISOString(),
          last_event_at: daysAgo(2).toISOString(),
        },
        { onConflict: 'repo_full_name,github_issue_number' },
      )
      .select('id')
      .single();
    if (data?.id) issueIdByKey.set(`${i.repo}#${i.number}`, data.id);
  }
  console.warn(`  seeded ${ISSUES.length} demo issues across ${DEMO_REPOS.length} repos`);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

async function seedFrankRepos(): Promise<void> {
  const frankId = userIdByHandle.get('frank-mtnr');
  if (!frankId) return;
  // Attach each demo repo to Frank's install so the maintainer queue sees them.
  const { data: install } = await sb
    .from('github_installations')
    .select('id')
    .eq('user_id', frankId)
    .maybeSingle();
  if (!install?.id) return;
  for (const r of DEMO_REPOS) {
    await sb
      .from('installation_repositories')
      .upsert(
        { installation_id: install.id, repo_full_name: r.name },
        { onConflict: 'installation_id,repo_full_name' },
      );
    await sb.from('installation_user_repos').upsert(
      {
        installation_id: install.id,
        user_id: frankId,
        repo_full_name: r.name,
        permission_level: 'admin',
      },
      { onConflict: 'installation_id,user_id,repo_full_name' },
    );
  }
  console.warn(`  attached ${DEMO_REPOS.length} repos to Frank's install`);
}

type RecSeed = {
  handle: string;
  issueKey: string;
  status: 'open' | 'claimed' | 'completed';
  linkedPrUrl?: string;
  daysSinceClaim?: number;
  daysSinceCompleted?: number;
};

const RECS: RecSeed[] = [
  // Alice (L0): 2 open recs to claim
  { handle: 'alice', issueKey: 'demo/eclipse-cli#101', status: 'open' },
  { handle: 'alice', issueKey: 'demo/quark-ui#431', status: 'open' },
  // Bob (L1): 1 claimed with active PR, 1 completed, 1 open
  {
    handle: 'bob',
    issueKey: 'demo/notebook-rs#212',
    status: 'claimed',
    linkedPrUrl: 'https://github.com/demo/notebook-rs/pull/2120',
    daysSinceClaim: 2,
  },
  {
    handle: 'bob',
    issueKey: 'demo/eclipse-cli#102',
    status: 'completed',
    linkedPrUrl: 'https://github.com/demo/eclipse-cli/pull/1020',
    daysSinceCompleted: 5,
  },
  { handle: 'bob', issueKey: 'demo/voyager-api#321', status: 'open' },
  // Carol (L2): 1 claimed (M), 1 completed (M), 1 open (H)
  {
    handle: 'carol',
    issueKey: 'demo/quark-ui#432',
    status: 'claimed',
    linkedPrUrl: 'https://github.com/demo/quark-ui/pull/4320',
    daysSinceClaim: 1,
  },
  {
    handle: 'carol',
    issueKey: 'demo/notebook-rs#213',
    status: 'completed',
    linkedPrUrl: 'https://github.com/demo/notebook-rs/pull/2130',
    daysSinceCompleted: 9,
  },
  { handle: 'carol', issueKey: 'demo/lattice-search#543', status: 'open' },
  // Dave (L3): 1 completed H
  {
    handle: 'dave',
    issueKey: 'demo/eclipse-cli#104',
    status: 'completed',
    linkedPrUrl: 'https://github.com/demo/eclipse-cli/pull/1040',
    daysSinceCompleted: 12,
  },
  // Eve (L4): 1 completed H
  {
    handle: 'eve',
    issueKey: 'demo/notebook-rs#214',
    status: 'completed',
    linkedPrUrl: 'https://github.com/demo/notebook-rs/pull/2140',
    daysSinceCompleted: 18,
  },
];

async function seedRecommendations(): Promise<void> {
  let count = 0;
  for (const r of RECS) {
    const userId = userIdByHandle.get(r.handle);
    const issueId = issueIdByKey.get(r.issueKey);
    if (!userId || !issueId) continue;
    const issue = ISSUES.find((i) => `${i.repo}#${i.number}` === r.issueKey)!;
    const recommended = daysAgo((r.daysSinceClaim ?? r.daysSinceCompleted ?? 0) + 1);
    const expires = new Date(recommended.getTime() + 7 * 24 * 3600 * 1000);
    await sb.from('recommendations').upsert(
      {
        user_id: userId,
        issue_id: issueId,
        difficulty: issue.difficulty,
        xp_reward: XP_BY_DIFFICULTY[issue.difficulty],
        linked_pr_url: r.linkedPrUrl ?? null,
        recommended_at: recommended.toISOString(),
        expires_at: expires.toISOString(),
        claimed_at:
          r.status === 'open'
            ? null
            : daysAgo(r.daysSinceClaim ?? r.daysSinceCompleted ?? 0).toISOString(),
        completed_at:
          r.status === 'completed' ? daysAgo(r.daysSinceCompleted ?? 0).toISOString() : null,
        status: r.status,
      },
      { onConflict: 'user_id,issue_id' },
    );
    count++;
  }
  console.warn(`  seeded ${count} recommendations`);
}

type PrSeed = {
  authorHandle: string;
  repo: string;
  number: number;
  title: string;
  state: 'open' | 'merged';
  daysAgo: number;
  draft?: boolean;
  mentorVerifiedBy?: string;
};

const PRS: PrSeed[] = [
  // Bob's PRs
  {
    authorHandle: 'bob',
    repo: 'demo/notebook-rs',
    number: 2120,
    title: 'Add Default impl for Notebook',
    state: 'open',
    daysAgo: 2,
  },
  {
    authorHandle: 'bob',
    repo: 'demo/eclipse-cli',
    number: 1020,
    title: 'Add --version flag',
    state: 'merged',
    daysAgo: 5,
  },
  // Carol's PRs
  {
    authorHandle: 'carol',
    repo: 'demo/quark-ui',
    number: 4320,
    title: 'Add Tooltip primitive',
    state: 'open',
    daysAgo: 1,
    mentorVerifiedBy: 'dave',
  },
  {
    authorHandle: 'carol',
    repo: 'demo/notebook-rs',
    number: 2130,
    title: 'Stream cells lazily for large files',
    state: 'merged',
    daysAgo: 9,
  },
  // Dave's merged H
  {
    authorHandle: 'dave',
    repo: 'demo/eclipse-cli',
    number: 1040,
    title: 'Plugin architecture for custom commands',
    state: 'merged',
    daysAgo: 12,
    mentorVerifiedBy: 'eve',
  },
  // Eve's merged H
  {
    authorHandle: 'eve',
    repo: 'demo/notebook-rs',
    number: 2140,
    title: 'Migrate sync IO to tokio',
    state: 'merged',
    daysAgo: 18,
  },
];

const prRowIdByPrUrl = new Map<string, number>();

async function seedPullRequests(): Promise<void> {
  for (const p of PRS) {
    const authorId = userIdByHandle.get(p.authorHandle);
    if (!authorId) continue;
    const url = `https://github.com/${p.repo}/pull/${p.number}`;
    const createdAt = daysAgo(p.daysAgo + 1).toISOString();
    const updatedAt = daysAgo(p.daysAgo).toISOString();
    const mergedAt = p.state === 'merged' ? updatedAt : null;
    const mentorReviewerId = p.mentorVerifiedBy ? userIdByHandle.get(p.mentorVerifiedBy) : null;
    const { data } = await sb
      .from('pull_requests')
      .upsert(
        {
          github_pr_id: 9_000_000 + p.number,
          repo_full_name: p.repo,
          number: p.number,
          title: p.title,
          body_excerpt: `closes #${Math.floor(p.number / 10)}`,
          author_login: p.authorHandle,
          author_user_id: authorId,
          state: p.state,
          draft: p.draft ?? false,
          url,
          github_created_at: createdAt,
          github_updated_at: updatedAt,
          merged_at: mergedAt,
          mentor_verified: !!mentorReviewerId,
          mentor_reviewer_id: mentorReviewerId,
          mentor_review_at: mentorReviewerId ? updatedAt : null,
        },
        { onConflict: 'github_pr_id' },
      )
      .select('id')
      .single();
    if (data?.id) prRowIdByPrUrl.set(url, data.id);
  }
  console.warn(`  seeded ${PRS.length} pull_requests`);
}

type ReviewSeed = {
  reviewerHandle: string;
  prUrl: string;
  state: 'approved' | 'changes_requested' | 'commented';
  isMentor: boolean;
  daysAgo: number;
  body: string;
};

const REVIEWS: ReviewSeed[] = [
  // Dave reviews Carol's open quark-ui PR (mentor verified, L3 > L2)
  {
    reviewerHandle: 'dave',
    prUrl: 'https://github.com/demo/quark-ui/pull/4320',
    state: 'changes_requested',
    isMentor: true,
    daysAgo: 1,
    body: 'Looks great overall. A few comments inline — the variant prop needs to handle null explicitly.',
  },
  // Eve reviews Dave's merged eclipse-cli PR
  {
    reviewerHandle: 'eve',
    prUrl: 'https://github.com/demo/eclipse-cli/pull/1040',
    state: 'approved',
    isMentor: true,
    daysAgo: 13,
    body: 'Nice plugin design. The trait boundaries make this future-proof.',
  },
  // Carol reviews Bob's open notebook-rs PR (not mentor, L2 == L1 author level diff... actually L2 > L1)
  {
    reviewerHandle: 'carol',
    prUrl: 'https://github.com/demo/notebook-rs/pull/2120',
    state: 'commented',
    isMentor: true,
    daysAgo: 2,
    body: 'Small nit: the Default value for cells should be Vec::new() not None.',
  },
];

async function seedReviews(): Promise<void> {
  let count = 0;
  for (const r of REVIEWS) {
    const reviewerId = userIdByHandle.get(r.reviewerHandle);
    const prId = prRowIdByPrUrl.get(r.prUrl);
    if (!reviewerId || !prId) continue;
    await sb.from('pull_request_reviews').upsert(
      {
        pr_id: prId,
        github_review_id: 8_000_000 + prId + r.daysAgo * 31,
        reviewer_login: r.reviewerHandle,
        reviewer_user_id: reviewerId,
        state: r.state,
        body_excerpt: r.body.slice(0, 500),
        is_mentor: r.isMentor,
        submitted_at: daysAgo(r.daysAgo).toISOString(),
      },
      { onConflict: 'github_review_id' },
    );
    count++;
  }
  console.warn(`  seeded ${count} pull_request_reviews`);
}

type HelpSeed = {
  menteeHandle: string;
  prUrl: string;
  reason: string;
  status: 'open' | 'resolved';
  resolverHandle?: string;
  daysAgo: number;
};

const HELP: HelpSeed[] = [
  // Bob has an open help request on his notebook-rs PR
  {
    menteeHandle: 'bob',
    prUrl: 'https://github.com/demo/notebook-rs/pull/2120',
    reason: 'Stuck on borrow checker for the Default impl — keep getting lifetime errors.',
    status: 'open',
    daysAgo: 1,
  },
  // Carol's resolved help request — Dave resolved it
  {
    menteeHandle: 'carol',
    prUrl: 'https://github.com/demo/quark-ui/pull/4320',
    reason: 'Not sure how to handle the controlled vs uncontrolled API for Tooltip.',
    status: 'resolved',
    resolverHandle: 'dave',
    daysAgo: 2,
  },
];

async function seedHelpRequests(): Promise<void> {
  let count = 0;
  let dispatchCount = 0;
  // Mentors that get dispatched to (L2+ users)
  const MENTOR_HANDLES = ['carol', 'dave', 'eve'];

  for (const h of HELP) {
    const menteeId = userIdByHandle.get(h.menteeHandle);
    if (!menteeId) continue;
    const resolverId = h.resolverHandle ? userIdByHandle.get(h.resolverHandle) : null;
    const { data } = await sb
      .from('help_requests')
      .insert({
        user_id: menteeId,
        pr_url: h.prUrl,
        reason: h.reason,
        status: h.status,
        resolved_by: resolverId,
        created_at: daysAgo(h.daysAgo + 1).toISOString(),
        resolved_at: h.status === 'resolved' ? daysAgo(h.daysAgo).toISOString() : null,
      })
      .select('id')
      .single();
    count++;

    // Mirror what help-dispatch Inngest does: write activity_log rows so the
    // mentors' /help-inbox actually surfaces this. Only dispatch to mentors
    // who aren't the mentee themselves.
    if (data?.id && h.status === 'open') {
      for (const mentorHandle of MENTOR_HANDLES) {
        if (mentorHandle === h.menteeHandle) continue;
        const mentorId = userIdByHandle.get(mentorHandle);
        if (!mentorId) continue;
        await sb.from('activity_log').insert({
          user_id: mentorId,
          kind: 'help_dispatch',
          detail: { helpRequestId: data.id, prUrl: h.prUrl } as never,
          created_at: daysAgo(h.daysAgo).toISOString(),
        });
        dispatchCount++;
      }
    }
  }
  console.warn(`  seeded ${count} help_requests + ${dispatchCount} help_dispatch notifications`);
}

async function seedMergeXpEvents(): Promise<void> {
  // For each merged PR with a completed rec, insert the recommended_merge xp_event.
  // The trigger handles xp + level recompute on profiles.
  let count = 0;
  for (const p of PRS) {
    if (p.state !== 'merged') continue;
    const authorId = userIdByHandle.get(p.authorHandle);
    if (!authorId) continue;
    const rec = RECS.find((r) => r.linkedPrUrl === `https://github.com/${p.repo}/pull/${p.number}`);
    if (!rec) continue;
    const issue = ISSUES.find((i) => `${i.repo}#${i.number}` === rec.issueKey);
    if (!issue) continue;
    await sb.from('xp_events').upsert(
      {
        user_id: authorId,
        source: 'recommended_merge',
        ref_type: 'pr',
        ref_id: `pr:${p.repo}:${p.number}`,
        repo: p.repo,
        difficulty: issue.difficulty,
        xp_delta: XP_BY_DIFFICULTY[issue.difficulty],
        metadata: { synthetic: true, recId: 'seed' } as never,
        created_at: daysAgo(p.daysAgo).toISOString(),
      },
      { onConflict: 'user_id,source,ref_id' },
    );
    count++;
  }

  // Mentor / help-review XP for Dave (resolved Carol's help) and Eve (review on Dave's merged PR).
  const daveId = userIdByHandle.get('dave');
  if (daveId) {
    await sb.from('xp_events').upsert(
      {
        user_id: daveId,
        source: 'help_review',
        ref_type: 'review',
        ref_id: 'help-review:seed-carol:dave',
        repo: 'demo/quark-ui',
        xp_delta: 65, // base 30 + mentor 25 + speed 10
        metadata: { synthetic: true, isMentor: true, isFast: true } as never,
        created_at: daysAgo(2).toISOString(),
      },
      { onConflict: 'user_id,source,ref_id' },
    );
    count++;
  }

  console.warn(`  seeded ${count} additional xp_events (merges + help reviews)`);
}

async function seedActivityLog(): Promise<void> {
  // A handful of recent activity rows so /settings/usage isn't empty.
  const entries = [
    {
      handle: 'bob',
      kind: 'rec_claimed',
      detail: { repo: 'demo/notebook-rs', issue: 212 },
      daysAgo: 2,
    },
    {
      handle: 'bob',
      kind: 'pr_opened',
      detail: { repo: 'demo/notebook-rs', number: 2120 },
      daysAgo: 2,
    },
    {
      handle: 'bob',
      kind: 'help_sent',
      detail: { prUrl: 'https://github.com/demo/notebook-rs/pull/2120' },
      daysAgo: 1,
    },
    {
      handle: 'carol',
      kind: 'rec_claimed',
      detail: { repo: 'demo/quark-ui', issue: 432 },
      daysAgo: 1,
    },
    {
      handle: 'carol',
      kind: 'pr_merged',
      detail: { repo: 'demo/notebook-rs', number: 2130 },
      daysAgo: 9,
    },
    {
      handle: 'dave',
      kind: 'mentor_comment_posted',
      detail: { repo: 'demo/quark-ui', number: 4320 },
      daysAgo: 1,
    },
    {
      handle: 'eve',
      kind: 'mentor_comment_posted',
      detail: { repo: 'demo/eclipse-cli', number: 1040 },
      daysAgo: 12,
    },
  ];
  let count = 0;
  for (const e of entries) {
    const userId = userIdByHandle.get(e.handle);
    if (!userId) continue;
    await sb.from('activity_log').insert({
      user_id: userId,
      kind: e.kind,
      detail: e.detail as never,
      created_at: daysAgo(e.daysAgo).toISOString(),
    });
    count++;
  }
  console.warn(`  seeded ${count} activity_log rows`);
}

async function main(): Promise<void> {
  console.warn('Seeding MergeShip dev personas...');
  for (const p of PERSONAS) {
    await seedPersona(p);
  }
  console.warn('Seeding demo operational data...');
  await seedDemoIssues();
  await seedFrankRepos();
  await seedRecommendations();
  await seedPullRequests();
  await seedReviews();
  await seedHelpRequests();
  await seedMergeXpEvents();
  await seedActivityLog();
  console.warn(
    'Done. Sign in at /dev/login with any persona email + password "dev-password-only".',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
