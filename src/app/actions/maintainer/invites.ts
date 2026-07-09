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

import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { listMaintainerRepos } from '@/lib/maintainer/detect';
import { getDb } from '@/lib/db/client';
import { organizationInvites, githubInstallations, profiles } from '@/lib/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { sendOrganizationInviteEmail } from '@/lib/email';

export type InviteRow = {
  id: string;
  email: string;
  sent_at: string;
  expires_at: string;
};

export async function listPendingInvites(installationId: number): Promise<Result<InviteRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:list-invites', ...RATE_LIMIT_TIERS.GENEROUS },
  });
  if (!authRes.ok) return authRes;
  const { user } = authRes.data;

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) return err('not_authorised', 'Not your install');

  const db = getDb();
  const pending = await db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.installationId, installationId),
        isNull(organizationInvites.acceptedAt),
        gt(organizationInvites.expiresAt, new Date()),
      ),
    );

  const rows: InviteRow[] = pending.map((row) => ({
    id: row.id,
    email: row.email,
    sent_at: row.sentAt.toISOString(),
    expires_at: row.expiresAt.toISOString(),
  }));

  return ok(rows);
}

export async function sendInvite(
  installationId: number,
  email: string,
): Promise<Result<InviteRow>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:send-invite', ...RATE_LIMIT_TIERS.STANDARD },
  });
  if (!authRes.ok) return authRes;
  const { user } = authRes.data;

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) return err('not_authorised', 'Not your install');

  const db = getDb();

  const [org] = await db
    .select({ accountLogin: githubInstallations.accountLogin })
    .from(githubInstallations)
    .where(eq(githubInstallations.id, installationId));

  if (!org) return err('not_found', 'Organization not found');

  const [profile] = await db
    .select({ githubHandle: profiles.githubHandle })
    .from(profiles)
    .where(eq(profiles.id, user.id));

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invite] = await db
    .insert(organizationInvites)
    .values({
      installationId,
      email,
      expiresAt,
    })
    .returning();

  if (!invite) return err('server_error', 'Failed to create invite');

  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/invite/${invite.id}`;

  await sendOrganizationInviteEmail({
    to: email,
    inviteLink,
    inviterHandle: profile?.githubHandle || 'A maintainer',
    organizationName: org.accountLogin,
  });

  return ok({
    id: invite.id,
    email: invite.email,
    sent_at: invite.sentAt.toISOString(),
    expires_at: invite.expiresAt.toISOString(),
  });
}

export async function resendInvite(inviteId: string): Promise<Result<void>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:resend-invite', ...RATE_LIMIT_TIERS.STANDARD },
  });
  if (!authRes.ok) return authRes;
  const { user } = authRes.data;

  const db = getDb();

  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(eq(organizationInvites.id, inviteId));

  if (!invite) return err('not_found', 'Invite not found');

  const repos = await listMaintainerRepos(user.id, Number(invite.installationId));
  if (repos.length === 0) return err('not_authorised', 'Not your install');

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [updatedInvite] = await db
    .update(organizationInvites)
    .set({
      sentAt: new Date(),
      expiresAt,
    })
    .where(eq(organizationInvites.id, inviteId))
    .returning();

  if (!updatedInvite) return err('server_error', 'Failed to update invite');

  const [org] = await db
    .select({ accountLogin: githubInstallations.accountLogin })
    .from(githubInstallations)
    .where(eq(githubInstallations.id, Number(invite.installationId)));

  const [profile] = await db
    .select({ githubHandle: profiles.githubHandle })
    .from(profiles)
    .where(eq(profiles.id, user.id));

  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/invite/${invite.id}`;

  await sendOrganizationInviteEmail({
    to: invite.email,
    inviteLink,
    inviterHandle: profile?.githubHandle || 'A maintainer',
    organizationName: org?.accountLogin || 'MergeShip',
  });

  return ok(undefined);
}
