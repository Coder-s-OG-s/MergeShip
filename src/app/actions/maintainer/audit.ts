import { tryGetDb } from '@/lib/db/client';
import { maintainerAuditLogs, profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type MaintainerAuditLogData = {
  actorUserId?: string | null;
  installationId?: number | null;
  action: string;
  targetType: string;
  targetId: string;
  status?: 'success' | 'failed';
  errorMessage?: string | null;
  oldValues?: any;
  newValues?: any;
};

export async function logMaintainerAction(data: MaintainerAuditLogData) {
  try {
    const db = tryGetDb();
    if (!db) return;

    let actorSnapshot = null;
    if (data.actorUserId) {
      const user = await db.query.profiles.findFirst({
        where: eq(profiles.id, data.actorUserId),
        columns: { githubHandle: true, displayName: true, role: true },
      });
      if (user) {
        actorSnapshot = user;
      }
    }

    await db.insert(maintainerAuditLogs).values({
      actorUserId: data.actorUserId || null,
      actorSnapshot,
      installationId: data.installationId || null,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      status: data.status || 'success',
      errorMessage: data.errorMessage || null,
      oldValues: data.oldValues || null,
      newValues: data.newValues || null,
    });
  } catch (error) {
    // Swallow error to prevent breaking parent action
    console.error('[Maintainer Audit] Failed to write maintainer audit log', { error, data });
  }
}
