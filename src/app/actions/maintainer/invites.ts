'use server';

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
