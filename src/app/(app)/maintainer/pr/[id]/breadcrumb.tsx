import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbProps {
  repoFullName: string;
  prNumber: number;
  installationId: number;
}

export function PRBreadcrumb({ repoFullName, prNumber, installationId }: BreadcrumbProps) {
  return (
    <nav className="mb-4 flex items-center gap-1.5 text-xs text-zinc-500">
      <Link
        href={`/maintainer?install=${installationId}`}
        className="transition-colors hover:text-white"
      >
        PR Queue
      </Link>
      <ChevronRight className="h-3 w-3 text-zinc-700" />
      <span className="text-zinc-400">{repoFullName}</span>
      <ChevronRight className="h-3 w-3 text-zinc-700" />
      <span className="font-medium text-white">#{prNumber}</span>
    </nav>
  );
}
