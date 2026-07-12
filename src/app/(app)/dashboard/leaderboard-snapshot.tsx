import { getServiceSupabase } from '@/lib/supabase/service';

export default async function LeaderboardSnapshot({ githubHandle }: { githubHandle: string }) {
  const service = getServiceSupabase();
  if (!service) return null;

  // Get current user's level
  const { data: currentProfile } = await service
    .from('profiles')
    .select('level')
    .eq('github_handle', githubHandle)
    .maybeSingle();

  const userLevel = currentProfile?.level ?? 0;

  // Leaderboard scoped to same level
  const { data: tierProfiles } = await service
    .from('profiles')
    .select('github_handle, xp, level')
    .eq('level', userLevel)
    .order('xp', { ascending: false });

  const allTier = tierProfiles ?? [];
  const myIndex = allTier.findIndex((p) => p.github_handle === githubHandle);

  const mappedProfiles = allTier.map((p, idx) => ({
    github_handle: p.github_handle,
    xp: p.xp,
    level: p.level,
    rank: idx + 1,
  }));

  const limit = 5;
  let displayProfiles: typeof mappedProfiles = [];

  if (myIndex === -1) {
    displayProfiles = mappedProfiles.slice(0, limit);
  } else if (mappedProfiles.length <= limit) {
    displayProfiles = mappedProfiles;
  } else {
    if (myIndex <= 2) {
      displayProfiles = mappedProfiles.slice(0, limit);
    } else if (myIndex >= mappedProfiles.length - 3) {
      displayProfiles = mappedProfiles.slice(mappedProfiles.length - limit);
    } else {
      displayProfiles = mappedProfiles.slice(myIndex - 2, myIndex + 3);
    }
  }

  return (
    <section className="flex h-full flex-col border border-zinc-800 bg-[#161b22] p-5">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
          LEADERBOARD SNAPSHOT
        </h2>
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#00FF87]">
          TIER L{userLevel}
        </span>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto pr-2 text-xs uppercase tracking-widest">
        {displayProfiles.length > 0 ? (
          displayProfiles.map((leader) => {
            const isMe = leader.github_handle === githubHandle;
            return (
              <div
                key={leader.github_handle}
                className={`flex justify-between border-b border-zinc-800 py-3.5 last:border-0 ${isMe ? '-mx-3 bg-[#00FF87]/10 px-3 text-[#00FF87]' : 'text-zinc-300'}`}
              >
                <div className="flex gap-5">
                  <span className={`w-6 ${isMe ? 'opacity-50' : 'text-zinc-600'}`}>
                    {leader.rank.toString().padStart(2, '0')}
                  </span>
                  {leader.github_handle} {isMe && '(YOU)'}
                </div>
                <span>{leader.xp.toLocaleString()} XP</span>
              </div>
            );
          })
        ) : (
          <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
            BE THE FIRST ON THE BOARD — MERGE A PR TO EARN XP
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
        <span className="text-[11px] uppercase tracking-widest text-zinc-500">GLOBAL</span>
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
