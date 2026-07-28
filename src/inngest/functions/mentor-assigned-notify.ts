import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { sendMentorAssignedEmail } from '@/lib/email';

/**
 * Notifies a mentor (via email + activity_log) when they are auto-assigned
 * to a PR by the mentor chain in process-pr-event.
 *
 * Decoupled from the assignment logic so:
 *   - A Resend outage can never block PR ingestion
 *   - Inngest retries email delivery independently
 *   - The activity_log row is written even if email fails
 *
 * Listens to: mentor/assigned
 * Fired by:   process-pr-event → maybe-auto-assign-mentor step
 */

type MentorAssignedEvent = {
  data: {
    mentorUserId: string;
    authorLogin: string;
    prUrl: string;
    prTitle: string;
    repo: string;
    prNumber: number;
  };
};

export const mentorAssignedNotify = inngest.createFunction(
  {
    id: 'mentor-assigned-notify',
    concurrency: { key: 'event.data.mentorUserId', limit: 1 },
  },
  { event: 'mentor/assigned' },
  async ({ event, step }) => {
    const { mentorUserId, authorLogin, prUrl, prTitle, repo, prNumber } = (
      event as MentorAssignedEvent
    ).data;

    // Write an in app notification so it shows in the activity feed
    // even if the email step fails or is retried.
    await step.run('log-activity', async () => {
      const sb = getServiceSupabase();
      if (!sb) return { skipped: true, reason: 'no_service_role' };

      await sb.from('activity_log').insert({
        user_id: mentorUserId,
        kind: 'mentor_auto_assigned',
        detail: { prUrl, prTitle, repo, prNumber, authorLogin } as never,
      });

      return { logged: true };
    });

    // Resolve the mentor's email and send the notification.
    return await step.run('send-email', async () => {
      const sb = getServiceSupabase();
      if (!sb) return { skipped: true, reason: 'no_service_role' };

      const { data: mentor } = await sb
        .from('profiles')
        .select('github_handle')
        .eq('id', mentorUserId)
        .maybeSingle();
      if (!mentor) return { skipped: true, reason: 'mentor_not_found' };

      const { data: emailRow } = await sb
        .from('profile_emails')
        .select('email')
        .eq('user_id', mentorUserId)
        .maybeSingle();
      if (!emailRow?.email) return { skipped: true, reason: 'no_email' };

      try {
        await sendMentorAssignedEmail({
          to: emailRow.email,
          mentorHandle: mentor.github_handle,
          authorHandle: authorLogin,
          prUrl,
          prTitle,
          repo,
        });
        return { emailed: true, to: emailRow.email };
      } catch (error) {
        console.error('[mentor-assigned-notify] email failed:', error);
        return { emailed: false, error: (error as Error).message };
      }
    });
  },
);
