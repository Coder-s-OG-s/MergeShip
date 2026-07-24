'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { AnalyticsRange } from '@/lib/maintainer/analytics-range';

interface RangeTabsProps {
  currentRange: AnalyticsRange;
}

export default function RangeTabs({ currentRange }: RangeTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleRangeChange = (range: AnalyticsRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', range);
    router.replace(`/maintainer/analytics?${params.toString()}`);
  };

  const tabs: { label: string; value: AnalyticsRange }[] = [
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: '90d', value: '90d' },
    { label: 'All time', value: 'all' },
  ];

  return (
    <div className="flex gap-4 border-b border-[#2d333b]">
      {tabs.map((tab) => {
        const active = currentRange === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleRangeChange(tab.value)}
            className={`px-1 pb-2 text-sm transition-colors ${
              active
                ? 'border-b-2 border-emerald-500 font-medium text-zinc-200'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label === '7d'
              ? '7 Days'
              : tab.label === '30d'
                ? '30 Days'
                : tab.label === '90d'
                  ? '90 Days'
                  : 'All Time'}
          </button>
        );
      })}
    </div>
  );
}
