import { IssueCard } from "@/components/ui/IssueCard";

export function IssueFeed() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Easy Pickings */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
          <h3 className="text-xs font-bold tracking-widest text-[#8B7E9F]">EASY PICKINGS</h3>
        </div>
        <IssueCard
          repo="facebook / react"
          title="Update documentation for useActionState hook"
          difficulty="EASY"
          labels={["Docs", "React"]}
          time="20m"
          xp={50}
          highlight="⭐ You starred this repository 3 months ago"
        />
      </div>

      {/* Standard Quests */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-2 h-2 rounded-full bg-[#FACC15]" />
          <h3 className="text-xs font-bold tracking-widest text-[#8B7E9F]">STANDARD QUESTS</h3>
        </div>
        <IssueCard
          repo="vercel / next.js"
          title="Refactor internal route cache handling"
          difficulty="MEDIUM"
          labels={["Caching", "TS"]}
          time="45m"
          xp={120}
          highlight="🔗 You have 4 past contributions here"
        />
      </div>

      {/* Elite Challenges */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
          <h3 className="text-xs font-bold tracking-widest text-[#8B7E9F]">ELITE CHALLENGES</h3>
        </div>
        <IssueCard
          repo="tailwind / engine"
          title="Implement Just-in-Time variant resolution engine"
          difficulty="HARD"
          labels={["Rust", "Parser"]}
          time="120m+"
          xp={350}
          highlight="💬 You commented on an issue here last week"
        />
      </div>
    </div>
  );
}
