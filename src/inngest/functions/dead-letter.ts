/**
 * Centralised Dead Letter Queue handler.
 *
 * Instead of every Inngest function manually catching errors and inserting
 * into `failed_webhook_events`, this single function listens to the
 * built-in `inngest/function.failed` event that fires only when a
 * function exhausts ALL retries (default 3).
 *
 * Benefits:
 *   - No false positives: only permanently failed events are logged.
 *   - Separation of concerns: business-logic functions just throw errors,
 *     they don't worry about error persistence.
 *   - Single place to change DLQ format, alerting, or routing.
 *
 * The retry route at /api/webhooks/github/retry already reads from
 * `failed_webhook_events` and re-dispatches via inngest.send(), so
 * this pairs naturally with the existing manual-retry flow.
 */

import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';

/** Only persist dead-letter rows for webhook-triggered functions. */
const WEBHOOK_FUNCTION_IDS = new Set([
  'process-pr-event',
  'process-review-event',
  'process-installation-event',
  'process-installation-repos-event',
  'process-issue-event',
  'process-issue-comment-event',
  'process-membership-event',
  'process-member-event',
]);

export const deadLetterHandler = inngest.createFunction(
  {
    id: 'dead-letter-handler',
    // No retries on the DLQ handler itself, if this fails we log to
    // console so ops can see it in the runtime logs.
    retries: 0,
  },
  { event: 'inngest/function.failed' },
  async ({ event }) => {
    const functionId: string = event.data?.function_id ?? 'unknown';

    // Only persist dead letter rows for webhook triggered functions.
    // Scheduled/cron functions (maintenance, digest, etc.) failing is
    // important but not actionable via the retry endpoint.
    if (!WEBHOOK_FUNCTION_IDS.has(functionId)) {
      console.warn(`[dead-letter] non-webhook function failed permanently: ${functionId}`);
      return { persisted: false, reason: 'not_webhook_function', functionId };
    }

    const sb = getServiceSupabase();
    if (!sb) {
      console.error('[dead-letter] service role unavailable, cannot persist failed event');
      return { persisted: false, reason: 'no_service_role' };
    }

    // Extract the original event data that the failed function was processing.
    const originalEvent = event.data?.event;
    const errorMessage = event.data?.error?.message ?? event.data?.error?.name ?? 'Unknown error';

    // The original event.data carries deliveryId and eventType set by
    // the webhook route in /api/webhooks/github/route.ts.
    const deliveryId: string = originalEvent?.data?.deliveryId ?? `auto-${Date.now()}`;
    const eventType: string = originalEvent?.name ?? `inngest/${functionId}`;

    const { error: insertError } = await sb.from('failed_webhook_events').insert({
      delivery_id: deliveryId,
      event_type: eventType,
      source: 'inngest/dead-letter',
      payload: originalEvent?.data ?? {},
      error: `[${functionId}] ${errorMessage}`,
      retry_count: 0,
    });

    if (insertError) {
      // Last-resort: log to stdout so cloud logging (Vercel, Datadog, etc.)
      // can still capture it even if DB is completely down.
      console.error('[dead-letter] failed to persist:', {
        functionId,
        deliveryId,
        insertError: insertError.message,
      });
      return { persisted: false, reason: 'insert_failed' };
    }

    return { persisted: true, functionId, deliveryId };
  },
);
