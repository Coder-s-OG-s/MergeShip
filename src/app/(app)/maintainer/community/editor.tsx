'use client';

import { useState, useTransition } from 'react';
import {
  upsertCommunityLink,
  deleteCommunityLink,
  type CommunityLink,
} from '@/app/actions/maintainer';
import type { CommunityKind } from '@/lib/maintainer/community';

export default function CommunityEditor({
  installationId,
  initialLinks,
  kinds,
}: {
  installationId: number;
  initialLinks: CommunityLink[];
  kinds: CommunityKind[];
}) {
  const [links, setLinks] = useState(initialLinks);
  const [kind, setKind] = useState<CommunityKind>('discord');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onAdd() {
    setError(null);
    startTransition(async () => {
      const res = await upsertCommunityLink({
        installationId,
        kind,
        url: url.trim(),
        label: label.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setLinks((prev) => {
        const filtered = prev.filter((l) => l.kind !== kind);
        return [
          ...filtered,
          {
            id: res.data.id,
            installationId,
            kind,
            url: url.trim(),
            label: label.trim() || null,
            updatedAt: new Date().toISOString(),
          },
        ].sort((a, b) => a.kind.localeCompare(b.kind));
      });
      setUrl('');
      setLabel('');
    });
  }

  function onDelete(linkId: number) {
    startTransition(async () => {
      const res = await deleteCommunityLink(linkId);
      if (res.ok) setLinks((prev) => prev.filter((l) => l.id !== linkId));
      else setError(res.error.message);
    });
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Add or update</h2>
        <div className="grid gap-2 sm:grid-cols-[10rem,1fr,12rem,auto]">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CommunityKind)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            type="url"
            placeholder="https://discord.gg/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            placeholder="optional label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          />
          <button
            onClick={onAdd}
            disabled={pending || !url}
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-rose-400" role="alert">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-zinc-500">One link per kind. Save again to update.</p>
      </div>

      <ul className="divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900">
        {links.length === 0 ? (
          <li className="p-5 text-sm text-zinc-500">No links yet.</li>
        ) : (
          links.map((l) => (
            <li key={l.id} className="flex items-center gap-3 p-4">
              <span className="w-20 text-xs uppercase tracking-wide text-zinc-500">{l.kind}</span>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate text-sm text-purple-300 hover:underline"
              >
                {l.label ?? l.url}
              </a>
              <button
                onClick={() => onDelete(l.id)}
                disabled={pending}
                className="text-xs text-zinc-500 hover:text-rose-400 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
