'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Loader2 } from 'lucide-react';
import { searchGlobal, type SearchResult } from '@/app/actions/search';
import { Dialog, DialogContent, DialogOverlay, DialogTitle } from '@radix-ui/react-dialog';

export function CommandPalette() {
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
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-[#2d333b] bg-[#161b22] px-3 py-2 text-[11px] uppercase tracking-widest text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
      >
        <Search className="h-3 w-3 shrink-0" />
        <span>SEARCH...</span>
        <span className="ml-auto rounded-sm border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-sans text-[9px]">
          ⌘K
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-all duration-100" />
        <DialogContent className="fixed left-[50%] top-[20%] z-50 w-full max-w-xl translate-x-[-50%] overflow-hidden rounded-xl border border-zinc-800 bg-[#161b22] shadow-2xl outline-none">
          <DialogTitle className="sr-only">Search issues and contributors</DialogTitle>
          <Command className="flex h-full w-full flex-col overflow-hidden bg-transparent text-zinc-300">
            <div className="flex items-center border-b border-zinc-800 px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="SEARCH ISSUES OR CONTRIBUTORS..."
                className="flex h-12 w-full rounded-md bg-transparent py-3 text-xs uppercase tracking-widest outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
            </div>
            <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2 text-sm">
              <Command.Empty className="py-6 text-center text-xs uppercase tracking-widest text-zinc-500">
                {search.length < 2
                  ? 'Type at least 2 characters to search'
                  : isPending
                    ? 'Searching...'
                    : 'No results found'}
              </Command.Empty>

              {results.profiles.length > 0 && (
                <Command.Group
                  heading={
                    <div className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
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
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm text-zinc-300 outline-none data-[selected=true]:bg-zinc-800 data-[selected=true]:text-white"
                    >
                      <div className="mr-3 h-6 w-6 shrink-0 overflow-hidden rounded-sm bg-zinc-700">
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
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        L{profile.level}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {results.issues.length > 0 && (
                <Command.Group
                  heading={
                    <div className="mt-2 px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
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
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm text-zinc-300 outline-none data-[selected=true]:bg-zinc-800 data-[selected=true]:text-white"
                    >
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span className="truncate font-serif text-[15px] text-zinc-200">
                          {issue.title}
                        </span>
                        <span className="truncate text-[10px] uppercase tracking-wider text-zinc-500">
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
