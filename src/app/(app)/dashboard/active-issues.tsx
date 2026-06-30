import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getRecommendations } from '@/app/actions/recommendations';
import { isOk } from '@/lib/result';
import RecCards from './rec-cards';

export default async function ActiveIssuesSection() {
  const recsResult = await getRecommendations();
  let recs: any[] = [];
  if (isOk(recsResult)) {
    recs = recsResult.data;
  }

  return (
    <section className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">ACTIVE ISSUES</h2>
        <Link
          href="/issues"
          className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 hover:text-white"
        >
          BROWSE MORE <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto pr-2">
        {recs.length > 0 ? (
          <RecCards recs={recs} />
        ) : (
          <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
            No recommendations yet. Check back soon.
          </div>
        )}
      </div>
    </section>
  );
}

export function RecsSkeleton() {
  return (
    <section className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">ACTIVE ISSUES</h2>
        <div className="h-4 w-28 animate-pulse bg-zinc-800" />
      </div>
      <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto pr-2">
        {[1, 2].map((i) => (
          <div key={i} className="border-b border-zinc-800 py-6 last:border-0">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-5 w-8 animate-pulse bg-zinc-800" />
            </div>
            <div className="mb-4 h-6 w-3/4 animate-pulse bg-zinc-800" />
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <div className="h-7 w-16 animate-pulse bg-zinc-800" />
                <div className="h-7 w-10 animate-pulse bg-zinc-800" />
              </div>
              <div className="h-4 w-12 animate-pulse bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
