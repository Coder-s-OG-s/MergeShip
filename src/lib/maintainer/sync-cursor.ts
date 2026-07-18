import { getServiceSupabase } from '@/lib/supabase/service';

export async function getSyncCursor(
  installationId: number,
  repoFullName: string,
  syncType: string,
): Promise<number | null> {
  const sb = getServiceSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('repo_sync_cursors')
    .select('page')
    .eq('installation_id', installationId)
    .eq('repo_full_name', repoFullName)
    .eq('sync_type', syncType)
    .maybeSingle();

  if (error || !data) return null;
  return data.page;
}

export async function setSyncCursor(
  installationId: number,
  repoFullName: string,
  syncType: string,
  page: number,
): Promise<void> {
  const sb = getServiceSupabase();
  if (!sb) return;

  await sb.from('repo_sync_cursors').upsert(
    {
      installation_id: installationId,
      repo_full_name: repoFullName,
      sync_type: syncType,
      page,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'installation_id,repo_full_name,sync_type' },
  );
}

export async function clearSyncCursor(
  installationId: number,
  repoFullName: string,
  syncType: string,
): Promise<void> {
  const sb = getServiceSupabase();
  if (!sb) return;

  await sb
    .from('repo_sync_cursors')
    .delete()
    .eq('installation_id', installationId)
    .eq('repo_full_name', repoFullName)
    .eq('sync_type', syncType);
}
