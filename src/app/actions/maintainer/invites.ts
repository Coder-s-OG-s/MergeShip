'use server';

import { ok, type Result } from '@/lib/result';

export type InviteRow = {
  id: string;
  email: string;
  sent_at: string;
  expires_at: string;
};

export async function listPendingInvites(installationId: number): Promise<Result<InviteRow[]>> {
  // Stub implementation for pending invites
  return ok([]);
}

export async function sendInvite(
  installationId: number,
  email: string,
): Promise<Result<InviteRow>> {
  // Stub implementation for sending invite
  return ok({
    id: `stub-${Date.now()}`,
    email,
    sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });
}

export async function resendInvite(inviteId: string): Promise<Result<void>> {
  // Stub implementation for resending invite
  return ok(undefined);
}
