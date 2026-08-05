import { notFound, redirect } from 'next/navigation';
import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { invites, githubInstallationUsers } from '@/lib/db/schema';
import { requireUser } from '@/lib/action-auth';

interface InvitePageProps {
  params: {
    token: string;
  };
}

export default async function InviteAcceptPage({ params }: InvitePageProps) {
  const { token } = params;
  const db = getDb();

  // 1. Look up the invitation token
  const [invite] = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.token, token),
        eq(invites.status, 'pending'),
        gt(invites.expiresAt, new Date()),
      ),
    )
    .limit(1);

  // If token is invalid, modified, or expired, instantly bail out
  if (!invite) {
    notFound();
  }

  // 2. Check the user authentication block
  const authResult = await requireUser();

  // If user session doesn't exist, route them to login while preserving the return destination
  if (!authResult.ok) {
    redirect(`/login?next=/invite/${token}`);
  }

  const user = authResult.data.user;

  // 3. Atomically update the database tracking rows inside a transaction
  await db.transaction(async (tx) => {
    // A. Link profiles.id to the target github_installation_users map table
    // Adjust permission_level or source strings to match your enum constraints if required
    await tx
      .insert(githubInstallationUsers)
      .values({
        installationId: invite.installationId,
        userId: user.id,
        permissionLevel: 'repo_maintain', // contributor join tier
        source: 'manual_invite',
        verifiedAt: new Date(),
      })
      .onConflictDoNothing(); // Prevents duplicate primary key assignment crashes

    // B. Mark the invitation token row as accepted
    await tx
      .update(invites)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
      })
      .where(eq(invites.id, invite.id));
  });

  // 4. Send them straight into their new command center layout
  redirect('/maintainer/contributors');
}
