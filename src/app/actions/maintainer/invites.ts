'use server';

import crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { invites, githubInstallations, githubInstallationUsers } from '@/lib/db/schema';
import { requireMaintainer } from '@/lib/action-auth';
import { sendInviteEmail } from '@/lib/email';

export type Result<T> = { success: true; data: T } | { success: false; error: string };

export type InviteRow = typeof invites.$inferSelect;

/**
 * Verifies if the authenticated maintainer has access to the target installation
 */
async function verifyInstallationAccess(userId: string, installationId: number): Promise<boolean> {
  const db = getDb();
  const access = await db
    .select()
    .from(githubInstallationUsers)
    .where(
      and(
        eq(githubInstallationUsers.installationId, installationId),
        eq(githubInstallationUsers.userId, userId),
      ),
    )
    .limit(1);

  return access.length > 0;
}

/**
 * 1. Send Invite Action
 */
export async function sendInvite(installationId: number, email: string): Promise<Result<void>> {
  try {
    const authResult = await requireMaintainer();
    if (!authResult.ok) {
      return { success: false, error: 'Unauthorized: Not a valid maintainer session' };
    }

    const user = authResult.data.user;
    const db = getDb();

    const hasAccess = await verifyInstallationAccess(user.id, installationId);
    if (!hasAccess) return { success: false, error: 'Unauthorized installation access' };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return { success: false, error: 'Invalid email format' };

    const existing = await db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.installationId, installationId),
          eq(invites.email, email),
          eq(invites.status, 'pending'),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'A pending invite already exists for this email' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(invites).values({
      installationId,
      invitedByUserId: user.id,
      email,
      token,
      status: 'pending',
      sentAt,
      expiresAt,
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${token}`;

    await sendInviteEmail({ to: email, inviteUrl });

    return { success: true, data: undefined };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send invite' };
  }
}

/**
 * 2. Resend Invite Action
 */
export async function resendInvite(inviteId: number): Promise<Result<void>> {
  try {
    const authResult = await requireMaintainer();
    if (!authResult.ok) return { success: false, error: 'Unauthorized' };
    const user = authResult.data.user;
    const db = getDb();

    const [invite] = await db.select().from(invites).where(eq(invites.id, inviteId)).limit(1);
    if (!invite) return { success: false, error: 'Invite not found' };

    const hasAccess = await verifyInstallationAccess(user.id, invite.installationId);
    if (!hasAccess) return { success: false, error: 'Unauthorized installation access' };

    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db
      .update(invites)
      .set({ sentAt, expiresAt, status: 'pending' })
      .where(eq(invites.id, inviteId));

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${invite.token}`;

    await sendInviteEmail({ to: invite.email, inviteUrl });

    return { success: true, data: undefined };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to resend invite' };
  }
}

/**
 * 3. List Pending Invites Action
 */
export async function listPendingInvites(installationId: number): Promise<Result<InviteRow[]>> {
  try {
    const authResult = await requireMaintainer();
    if (!authResult.ok) return { success: false, error: 'Unauthorized' };
    const user = authResult.data.user;
    const db = getDb();

    const hasAccess = await verifyInstallationAccess(user.id, installationId);
    if (!hasAccess) return { success: false, error: 'Unauthorized installation access' };

    const rows = await db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.installationId, installationId),
          eq(invites.status, 'pending'),
          gt(invites.expiresAt, new Date()),
        ),
      );

    return { success: true, data: rows };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to retrieve pending invites' };
  }
}

/**
 * 4. Revoke Invite Action
 */
export async function revokeInvite(inviteId: number): Promise<Result<void>> {
  try {
    const authResult = await requireMaintainer();
    if (!authResult.ok) return { success: false, error: 'Unauthorized' };
    const user = authResult.data.user;
    const db = getDb();

    const [invite] = await db.select().from(invites).where(eq(invites.id, inviteId)).limit(1);
    if (!invite) return { success: false, error: 'Invite not found' };

    const hasAccess = await verifyInstallationAccess(user.id, invite.installationId);
    if (!hasAccess) return { success: false, error: 'Unauthorized installation access' };

    await db.delete(invites).where(eq(invites.id, inviteId));

    return { success: true, data: undefined };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to revoke invite' };
  }
}
