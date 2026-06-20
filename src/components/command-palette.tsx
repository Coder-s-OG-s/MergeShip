'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Loader2 } from 'lucide-react';
import { searchGlobal, type SearchResult } from '@/app/actions/search';
import { Dialog, DialogContent, DialogOverlay, DialogTitle } from '@radix-ui/react-dialog';

export function CommandPalette({
  variant = 'default',
}: {
  variant?: 'default' | 'sidebar' | 'navbar';
}) {
  const isSidebar = variant === 'sidebar';
  const isNavbar = variant === 'navbar';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult>({ issues: [], profiles: [] });
  const [isPending, startTransition] = useTransition();

  // Toggle dialog with Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length >= 2) {
        startTransition(async () => {
          const res = await searchGlobal(search);
          if (res.ok) {
            setResults(res.data);
          }
        });
      } else {
        setResults({ issues: [], profiles: [] });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setSearch('');
      setResults({ issues: [], profiles: [] });
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isSidebar
            ? 'flex w-full cursor-pointer items-center gap-2 border border-[#ddd9d0] bg-[#ebe9e4] px-2.5 py-[7px] text-[11px] uppercase tracking-[0.05em] text-[#6b6860] transition-colors hover:border-[#c8c4bb] hover:text-[#111110]'
            : isNavbar
              ? 'flex w-full cursor-pointer items-center gap-2 border border-[#3a3a36] bg-transparent px-2.5 py-2 text-[11px] uppercase tracking-[0.08em] text-[#b8b3aa] transition-colors hover:border-[#f2f0eb] hover:text-[#f2f0eb]'
              : 'flex w-full cursor-pointer items-center gap-2 border border-[#2a2a28] bg-[#1a1a18] px-2.5 py-[7px] text-[11px] uppercase tracking-[0.05em] text-[#b8b3aa] transition-colors hover:border-[#3a3a36] hover:text-[#f2f0eb]'
        }
        style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
      >
        <Search className="h-3 w-3 shrink-0" />
        <span className="flex-1 text-left">Search...</span>
        <span
          className={
            isSidebar
              ? 'border border-[#c8c4bb] bg-[#ddd9d0] px-1.5 py-px text-[9px] text-[#6b6860]'
              : isNavbar
                ? 'border border-[#3a3a36] bg-[#1a1a18] px-1.5 py-px text-[9px] text-[#8a877e]'
                : 'border border-[#3a3a36] bg-[#2a2a28] px-1.5 py-px text-[9px] text-[#8a877e]'
          }
          style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
        >
          ⌘K
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-all duration-100" />
        <DialogContent className="fixed left-[50%] top-[20%] z-50 w-full max-w-xl translate-x-[-50%] overflow-hidden border border-[#2a2a28] bg-[#111110] shadow-2xl outline-none">
          <DialogTitle className="sr-only">Search issues and contributors</DialogTitle>
          <Command className="flex h-full w-full flex-col overflow-hidden bg-transparent text-[#f2f0eb]">
            <div className="flex items-center border-b border-[#2a2a28] px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 text-[#8a877e]" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="SEARCH ISSUES OR CONTRIBUTORS..."
                className="flex h-12 w-full bg-transparent py-3 text-xs uppercase tracking-[0.12em] outline-none placeholder:text-[#6b6860] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
              />
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-[#8a877e]" />}
            </div>
            <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2 text-sm">
              <Command.Empty
                className="py-6 text-center text-xs uppercase tracking-[0.1em] text-[#8a877e]"
                style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
              >
                {search.length < 2
                  ? 'Type at least 2 characters to search'
                  : isPending
                    ? 'Searching...'
                    : 'No results found'}
              </Command.Empty>

              {results.profiles.length > 0 && (
                <Command.Group
                  heading={
                    <div
                      className="px-2 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#16a34a]"
                      style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
                    >
                      Contributors
                    </div>
                  }
                >
                  {results.profiles.map((profile) => (
                    <Command.Item
                      key={profile.githubHandle}
                      value={profile.githubHandle}
                      onSelect={() => {
                        setOpen(false);
                        router.push(`/@${profile.githubHandle}`);
                      }}
                      className="relative flex cursor-pointer select-none items-center px-2 py-2 text-sm text-[#b8b3aa] outline-none data-[selected=true]:bg-[#1a1a18] data-[selected=true]:text-[#f2f0eb]"
                    >
                      <div className="mr-3 h-6 w-6 shrink-0 overflow-hidden bg-[#2a2a28]">
                        {profile.avatarUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={profile.avatarUrl}
                            alt={profile.githubHandle}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px]">
                            {profile.githubHandle.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold uppercase tracking-wide">
                          {profile.githubHandle}
                        </span>
                      </div>
                      <span
                        className="ml-auto text-[10px] font-medium uppercase tracking-[0.1em] text-[#8a877e]"
                        style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
                      >
                        L{profile.level}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {results.issues.length > 0 && (
                <Command.Group
                  heading={
                    <div
                      className="mt-2 px-2 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#16a34a]"
                      style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
                    >
                      Issues
                    </div>
                  }
                >
                  {results.issues.map((issue) => (
                    <Command.Item
                      key={issue.id}
                      value={issue.title}
                      onSelect={() => {
                        setOpen(false);
                        window.open(issue.url, '_blank', 'noopener,noreferrer');
                      }}
                      className="relative flex cursor-pointer select-none items-center px-2 py-2 text-sm text-[#b8b3aa] outline-none data-[selected=true]:bg-[#1a1a18] data-[selected=true]:text-[#f2f0eb]"
                    >
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span
                          className="truncate text-[15px] text-[#f2f0eb]"
                          style={{ fontFamily: 'var(--font-dm-serif), serif' }}
                        >
                          {issue.title}
                        </span>
                        <span
                          className="truncate text-[10px] uppercase tracking-[0.08em] text-[#8a877e]"
                          style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
                        >
                          {issue.repoFullName.split('/')[1] || issue.repoFullName}
                        </span>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
