'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { removeContributorFromOrg } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export function ContributorActionsMenu({
  installationId,
  userId,
  handle,
  isOrganization,
  onRemoved,
}: {
  installationId: number;
  userId: string;
  handle: string;
  isOrganization: boolean;
  onRemoved?: (userId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  async function handleRemove() {
    const confirmed = window.confirm(
      `Remove @${handle} from the organization? This cannot be undone from here.`,
    );
    if (!confirmed) return;

    setRemoving(true);
    try {
      const res = await removeContributorFromOrg(installationId, handle);
      if (isOk(res)) {
        onRemoved?.(userId);
      } else {
        alert(res.error.message);
      }
    } catch (e) {
      alert('Failed to remove contributor');
    } finally {
      setRemoving(false);
      setIsOpen(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="rounded p-1 text-zinc-400 hover:bg-[#161b22] hover:text-white"
        aria-label="Contributor actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-56 rounded-md border border-[#2d333b] bg-[#111318] py-1 shadow-lg">
          <a
            href={`https://github.com/${handle}`}
            target="_blank"
            rel="noreferrer"
            className="block px-4 py-2 text-[13px] text-zinc-300 hover:bg-[#161b22] hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            View GitHub Profile
          </a>
          <Link
            href={`/@${handle}`}
            className="block px-4 py-2 text-[13px] text-zinc-300 hover:bg-[#161b22] hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            View MergeShip Profile
          </Link>
          <Link
            href={`/maintainer?author=${handle}&install=${installationId}`}
            className="block px-4 py-2 text-[13px] text-zinc-300 hover:bg-[#161b22] hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            View PRs
          </Link>
          {isOrganization && (
            <>
              <div className="my-1 border-t border-[#2d333b]" />
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="block w-full px-4 py-2 text-left text-[13px] text-red-400 hover:bg-[#161b22] disabled:opacity-50"
              >
                {removing ? 'Removing...' : 'Remove from org'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
