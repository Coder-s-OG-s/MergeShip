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
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-widest text-[#8b949e]">
          Add or update
        </h2>
        <div className="grid gap-2 sm:grid-cols-[10rem,1fr,12rem,auto]">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CommunityKind)}
            className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-white focus:border-[#00d26a] focus:outline-none"
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
            className="min-w-0 rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:border-[#00d26a] focus:outline-none"
          />
          <input
            type="text"
            placeholder="optional label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:border-[#00d26a] focus:outline-none"
          />
          <button
            onClick={onAdd}
            disabled={pending || !url}
            className="rounded bg-[#00d26a] px-3 py-1.5 text-sm font-bold text-black transition-colors hover:bg-[#00d26a]/80 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-[#f85149]" role="alert">
            {error}
          </p>
        )}
        <p className="mt-3 text-[11px] text-zinc-600">One link per kind. Save again to update.</p>
      </div>

      <ul className="divide-y divide-[#30363d] rounded-lg border border-[#30363d] bg-[#161b22]">
        {links.length === 0 ? (
          <li className="p-5 text-[12px] text-zinc-500">No links yet.</li>
        ) : (
          links.map((l) => (
            <li key={l.id} className="flex items-center gap-3 p-4">
              <span className="w-20 text-[10px] uppercase tracking-wider text-[#8b949e]">
                {l.kind}
              </span>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate text-[12px] text-[#00d26a] hover:underline"
              >
                {l.label ?? l.url}
              </a>
              <button
                onClick={() => onDelete(l.id)}
                disabled={pending}
                className="text-[11px] text-zinc-600 transition-colors hover:text-[#f85149] disabled:opacity-50"
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
