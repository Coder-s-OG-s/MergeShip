import { notFound } from 'next/navigation';
import DevLoginButtons from './buttons';

export const dynamic = 'force-dynamic';

/**
 * Dev-only persona switcher. Returns 404 in production so this never ships.
 * Used by contributors and CI to sign in as one of the seeded test users
 * without needing real GitHub OAuth.
 */
export default function DevLoginPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const personas = [
    { email: 'alice@test.local', level: 'L0', label: 'Alice', blurb: 'Brand new, no audit yet' },
    { email: 'bob@test.local', level: 'L1', label: 'Bob', blurb: 'Audited, has active recs' },
    { email: 'carol@test.local', level: 'L2', label: 'Carol', blurb: '3 merges, mentor-eligible' },
    { email: 'dave@test.local', level: 'L3', label: 'Dave', blurb: 'Mentor with 5 mentees' },
    { email: 'eve@test.local', level: 'L4', label: 'Eve', blurb: 'Senior mentor, on call' },
    {
      email: 'frank@test.local',
      level: 'Maintainer',
      label: 'Frank',
      blurb: 'Owns demo/sample-repo',
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Dev login</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Local-only persona switcher. Disabled in production. Each persona is seeded with
            realistic xp_events history so triggers stay consistent.
          </p>
        </div>

        <DevLoginButtons personas={personas} />
      </div>
    </div>
  );
}
