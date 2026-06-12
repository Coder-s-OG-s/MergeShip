import { Resend } from 'resend';

type SendHelpDispatchEmailArgs = {
  to: string;
  mentorHandle: string;
  menteeHandle: string;
  prUrl: string;
  helpReason?: string | null;
};

const resendApiKey = process.env.RESEND_API_KEY;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendHelpDispatchEmail({
  to,
  mentorHandle,
  menteeHandle,
  prUrl,
  helpReason,
}: SendHelpDispatchEmailArgs) {
  if (!resend) {
    console.warn('RESEND_API_KEY missing, skipping email send');
    return { skipped: true };
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to,
    subject: '[MergeShip] Someone needs your help on a PR',
    html: `
      <h2>Someone needs your help on a PR</h2>

      <p>Hello ${mentorHandle},</p>

      <p>${menteeHandle} has requested help on a pull request.</p>

      <p>
        <strong>Pull Request:</strong><br />
        <a href="${prUrl}">${prUrl}</a>
      </p>

      ${
        helpReason
          ? `
        <p>
          <strong>Help Request:</strong><br />
          ${helpReason}
        </p>
      `
          : ''
      }

      <p>
        Visit the Help Inbox to respond and assist the contributor.
      </p>
    `,
  });
}
