import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import { getMaintainerInstalls } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const sb = getServerSupabase();
  if (!sb) redirect('/');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  const installsRes = await getMaintainerInstalls();
  const installs = isOk(installsRes) ? installsRes.data : [];

  return (
    <div className="min-h-full bg-[#0d1117] p-8 text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-[11px] uppercase tracking-widest text-[#8b949e]">
          Console Configuration
        </p>
      </div>

      {/* GitHub App section */}
      <div className="mb-6 rounded-lg border border-[#30363d] bg-[#161b22] p-5">
        <h2 className="mb-4 text-[13px] font-bold uppercase tracking-widest text-[#8b949e]">
          GitHub App Installations
        </h2>
        {installs.length === 0 ? (
          <p className="text-[12px] text-zinc-500">No installations found.</p>
        ) : (
          <ul className="divide-y divide-[#30363d]">
            {installs.map((install) => (
              <li key={install.installationId} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-white">{install.accountLogin}</div>
                    <div className="mt-0.5 flex gap-3 text-[11px] text-[#8b949e]">
                      <span>
                        Type: <span className="text-white">{install.accountType}</span>
                      </span>
                      <span>
                        Permission:{' '}
                        <span className="text-white">
                          {install.permissionLevel.replace('_', ' ')}
                        </span>
                      </span>
                      <span>
                        ID: <span className="font-mono text-white">{install.installationId}</span>
                      </span>
                    </div>
                  </div>
                  <span className="rounded bg-[#00d26a]/10 px-2 py-0.5 text-[10px] font-medium text-[#00d26a]">
                    ACTIVE
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Back to contributor view */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-widest text-[#8b949e]">
          Navigation
        </h2>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded border border-[#30363d] px-4 py-2 text-[12px] text-[#8b949e] transition-colors hover:border-[#8b949e] hover:text-white"
        >
          ← Back to contributor view
        </Link>
      </div>
    </div>
  );
}
