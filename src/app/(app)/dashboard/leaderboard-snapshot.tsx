import { getServiceSupabase } from '@/lib/supabase/service';

// 1. Add userLevel to the props
export default async function LeaderboardSnapshot({
  githubHandle,
  userLevel,
}: {
  githubHandle: string;
  userLevel: number;
}) {
  const service = getServiceSupabase();
  if (!service) return null;

  // 2. Update the query to filter by the user's level (tier)
  const { data: leaders } = await service
    .from('profiles')
    .select('github_handle, xp')
    .eq('level', userLevel) // Filter by the user's level
    .order('xp', { ascending: false })
    .limit(4);

  return (
    <section>
      <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
          LEVEL {userLevel} LEADERBOARD
        </h2>
        {/* Changed label from GLOBAL to COHORT/LEVEL */}
        <span className="text-[11px] uppercase tracking-widest text-emerald-500">
          LEVEL {userLevel}
        </span>
      </div>

      <div className="text-xs uppercase tracking-widest">
        {leaders && leaders.length > 0 ? (
          leaders.map((leader, index) => {
            const isMe = leader.github_handle === githubHandle;
            return (
              <div
                key={leader.github_handle}
                className={`flex justify-between border-b border-[#2d333b] py-3.5 ${isMe ? '-mx-3 bg-emerald-900/20 px-3 text-emerald-300' : 'text-zinc-400'}`}
              >
                <div className="flex gap-5">
                  <span className={`w-6 ${isMe ? 'opacity-50' : 'text-zinc-600'}`}>
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  {leader.github_handle} {isMe && '(YOU)'}
                </div>
                <span>{leader.xp.toLocaleString()} XP</span>
              </div>
            );
          })
        ) : (
          <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
            No other contributors at this level yet.
          </div>
        )}
      </div>
    </section>
  );
}

export function LeaderboardSkeleton() {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
          LEADERBOARD SNAPSHOT
        </h2>
        <span className="text-[11px] uppercase tracking-widest text-zinc-500">LOADING</span>
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between border-b border-[#2d333b] py-3.5">
            <div className="h-4 w-32 animate-pulse bg-zinc-800" />
            <div className="h-4 w-16 animate-pulse bg-zinc-800" />
          </div>
        ))}
      </div>
    </section>
  );
}
