import { useEffect, useState } from "react";
import { IssueCard } from "@/components/ui/IssueCard";
import { ChevronDown, Search, Sparkles } from "lucide-react";
import { account } from "@/lib/appwrite";
import { getContributorContext, getAnalyzedIssues } from "@/app/(contributor)/dashboard/actions";

export function IssueFeed({ handle, forceSync = false }: { handle: string; forceSync?: boolean }) {
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await getContributorContext(handle);
        if (data.success && data.repos.length > 0) {
          setRepos(data.repos);
          setSelectedRepo(data.repos[0].value);
        }
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, [handle]);

  useEffect(() => {
    if (selectedRepo) {
      const fetchIssues = async () => {
        setLoading(true);
        const res = await getAnalyzedIssues(selectedRepo, "INTERMEDIATE", forceSync);
        if (res.success) {
          setIssues(res.issues);
        }
        setLoading(false);
      };
      fetchIssues();
    }
  }, [selectedRepo, forceSync]);

  if (repos.length === 0) return <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />;

  return (
    <div className="flex flex-col gap-8">
      {/* Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-white/10 bg-[#1E1826] hover:bg-[#2A2136] transition-all group"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#B78AF7] to-[#7C3AED] flex items-center justify-center p-1">
              <Sparkles className="w-full h-full text-white" />
            </div>
            <span className="text-xs font-bold text-white tracking-wide uppercase">
              Target: <span className="text-[#D8B4FE] ml-2">{selectedRepo}</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-[#8B7E9F] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-[#1E1826] border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {repos.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => {
                      setSelectedRepo(r.value);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-5 py-3 text-xs font-bold transition-colors hover:bg-white/5 ${selectedRepo === r.value ? 'text-[#D8B4FE] bg-white/5' : 'text-[#8B7E9F]'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="text-[10px] font-black tracking-widest text-[#8B7E9F] uppercase bg-white/5 px-4 py-2 rounded-full border border-white/5">
           AI Triage active for your profile (L3)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse border border-white/5" />
          ))
        ) : (
          issues.map((issue, idx) => (
            <div key={idx}>
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className={`w-2 h-2 rounded-full ${
                  issue.difficulty === 'EASY' ? 'bg-[#4ADE80]' : 
                  issue.difficulty === 'MEDIUM' ? 'bg-[#FACC15]' : 'bg-[#EF4444]'
                }`} />
                <h3 className="text-xs font-bold tracking-widest text-[#8B7E9F] uppercase">
                  {issue.difficulty === 'EASY' ? 'EASY PICKINGS' : 
                   issue.difficulty === 'MEDIUM' ? 'STANDARD QUESTS' : 'ELITE CHALLENGES'}
                </h3>
              </div>
              <IssueCard
                repo={issue.repo}
                title={issue.title}
                difficulty={issue.difficulty}
                labels={issue.labels}
                time={issue.time}
                xp={issue.xp}
                highlight={issue.highlight}
                url={issue.url}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
