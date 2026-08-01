'use server';

import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { inngest } from '@/inngest/client';
import { listMaintainerRepos } from '@/lib/maintainer/detect';
import { revalidatePath } from 'next/cache';

/** Maximum number of manual retries allowed per dead-lettered event. */
const MAX_RETRIES = 5;

export type FailedWebhookEventRow = {
  id: number;
  deliveryId: string;
  eventType: string;
  source: string;
  error: string;
  retryCount: number;
  createdAt: string;
};

/**
 * Returns the count + most recent failed webhook events for a given
 * installation. Only returns events whose payload belongs to repos
 * the maintainer has access to.
 */
export async function getFailedWebhookEvents(args: {
  installationId: number;
  limit?: number;
}): Promise<Result<{ count: number; rows: FailedWebhookEventRow[] }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:failed-events', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const limit = Math.min(args.limit ?? 20, 50);

  // Scope to repos the caller actually maintains — not just any repos
  // on the installation. This prevents IDOR via a forged installationId.
  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) {
    return ok({ count: 0, rows: [] });
  }

  // Scope to the caller's installation at the DB level to avoid loading
  // cross-org webhook payloads into memory.
  const { data: events, error: fetchError } = await service
    .from('failed_webhook_events')
    .select('id, delivery_id, event_type, source, error, retry_count, created_at, payload')
    .eq('installation_id', args.installationId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (fetchError) return err('query_failed', fetchError.message);

  type RawEvent = {
    id: number;
    delivery_id: string;
    event_type: string;
    source: string;
    error: string;
    retry_count: number;
    created_at: string;
    payload: Record<string, unknown>;
  };

  const rawEvents = (events ?? []) as unknown as RawEvent[];

  // only keep events whose payload references a repo in this scope
  const scoped = rawEvents.filter((evt) => {
    const repoName = extractRepoFullName(evt.payload);
    return repoName !== null && repos.includes(repoName);
  });

  const rows: FailedWebhookEventRow[] = scoped.slice(0, limit).map((evt) => ({
    id: evt.id,
    deliveryId: evt.delivery_id,
    eventType: evt.event_type,
    source: evt.source,
    error: evt.error,
    retryCount: evt.retry_count,
    createdAt: evt.created_at,
  }));

  return ok({ count: scoped.length, rows });
}

/**
 * Helper to safely extract the repository full_name from various GitHub webhook payload structures.
 */
function extractRepoFullName(payload: Record<string, unknown>): string | null {
  const innerPayload = (payload?.payload ?? payload) as Record<string, unknown>;

  // 1. Direct repository object/string in payload (e.g. payload.repository.full_name)
  const repoObj = innerPayload?.repository as Record<string, unknown> | string | undefined;
  if (typeof repoObj === 'string') return repoObj;
  if (typeof repoObj?.full_name === 'string') return repoObj.full_name;

  // 2. Pull request payload where repository is nested under pull_request.base.repo
  const prObj = innerPayload?.pull_request as Record<string, unknown> | undefined;
  const baseObj = prObj?.base as Record<string, unknown> | undefined;
  const baseRepoObj = baseObj?.repo as Record<string, unknown> | string | undefined;
  if (typeof baseRepoObj === 'string') return baseRepoObj;
  if (typeof baseRepoObj?.full_name === 'string') return baseRepoObj.full_name;

  return null;
}

/**
 * Re-enqueue a failed webhook event for reprocessing via Inngest.
 * Increments the retry count and deletes the dead letter row on success.
 */
export async function retryFailedWebhookEvent(args: {
  eventId: number;
  installationId: number;
}): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:retry-event', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) return err('forbidden', 'No repos maintained');

  const { data: failedEvent } = await service
    .from('failed_webhook_events')
    .select('*')
    .eq('id', args.eventId)
    .maybeSingle();

  if (!failedEvent) return err('not_found', 'Event not found');

  const repoName = extractRepoFullName(failedEvent.payload as Record<string, unknown>);

  if (!repoName || !repos.includes(repoName)) {
    return err('forbidden', 'You do not have access to this event');
  }

  const eventType: string | undefined = failedEvent.event_type;
  if (!eventType || !eventType.startsWith('github/')) {
    return err('invalid_input', `Invalid event_type: ${eventType ?? 'null'}`);
  }

  // Use an atomic RPC call to prevent race conditions where
  // concurrent retries both pass the check before incrementing.
  const { data: rpcResult, error: rpcError } = await service.rpc('increment_webhook_retry_count', {
    event_id: args.eventId,
    max_retries: MAX_RETRIES,
  });

  if (rpcError || !rpcResult) {
    // If the RPC failed, it likely means the retry limit was exceeded.
    // Fetch the current state to return an accurate error.
    const { data: recheckEvent } = await service
      .from('failed_webhook_events')
      .select('retry_count')
      .eq('id', args.eventId)
      .maybeSingle();

    const currentRetries: number = recheckEvent?.retry_count ?? 0;
    return err('max_retries', `Max retries exceeded (${currentRetries}/${MAX_RETRIES})`);
  }

  await inngest.send({
    name: eventType,
    data: failedEvent.payload,
  });

  // Clean up the dead-letter row after successful dispatch.
  await service.from('failed_webhook_events').delete().eq('id', args.eventId);

  revalidatePath('/maintainer');

  return ok({ ok: true });
}
