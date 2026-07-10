import { Resend } from 'resend';

export function htmlEscape(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

      <p>Hello ${htmlEscape(mentorHandle)},</p>

      <p>${htmlEscape(menteeHandle)} has requested help on a pull request.</p>

      <p>
        <strong>Pull Request:</strong><br />
        <a href="${htmlEscape(prUrl)}">${htmlEscape(prUrl)}</a>
      </p>

      ${
        helpReason
          ? `
        <p>
          <strong>Help Request:</strong><br />
          ${htmlEscape(helpReason)}
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

export type SendWeeklyDigestEmailArgs = {
  to: string;
  githubHandle: string;
  xpGained: number;
  currentLevel: number;
  xpToNextLevel: number;
  issuesCompleted: number;
  prsMerged: number;
  reviewsPerformed: number;
  recommendations: Array<{ title: string; url: string; xpReward: number }>;
};

export async function sendWeeklyDigestEmail({
  to,
  githubHandle,
  xpGained,
  currentLevel,
  xpToNextLevel,
  issuesCompleted,
  prsMerged,
  reviewsPerformed,
  recommendations,
}: SendWeeklyDigestEmailArgs) {
  if (!resend) {
    console.warn('RESEND_API_KEY missing, skipping email send');
    return { skipped: true };
  }

  const recommendationsHtml =
    recommendations.length > 0
      ? `
      <h3>Recommended for you:</h3>
      <ul>
        ${recommendations.map((r) => `<li><a href="${r.url}">${r.title}</a> (+${r.xpReward} XP)</li>`).join('')}
      </ul>
    `
      : '';

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to,
    subject: '[MergeShip] Your Weekly Contributor Digest',
    html: `
      <h2>Your Weekly Progress Digest</h2>

      <p>Hello ${githubHandle}, here's what you achieved this week on MergeShip!</p>

      <h3>Progress</h3>
      <ul>
        <li><strong>XP Gained:</strong> ${xpGained} XP</li>
        <li><strong>Current Level:</strong> Level ${currentLevel}</li>
        <li><strong>Progress to Next Level:</strong> ${xpToNextLevel} XP needed</li>
      </ul>

      <h3>Activity</h3>
      <ul>
        <li><strong>Issues Completed:</strong> ${issuesCompleted}</li>
        <li><strong>PRs Merged:</strong> ${prsMerged}</li>
        <li><strong>Reviews Performed:</strong> ${reviewsPerformed}</li>
      </ul>

      ${recommendationsHtml}

      <p>
        View your dashboard: <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://mergeship.com'}">${process.env.NEXT_PUBLIC_APP_URL || 'https://mergeship.com'}</a>
      </p>
      <br />
      <p style="font-size: 12px; color: #666;">
        You can unsubscribe from these emails by updating your <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://mergeship.com'}/settings/profile">Profile Settings</a>.
      </p>
    `,
    text: `Your Weekly Progress Digest\n\nHello ${githubHandle}, here's what you achieved this week on MergeShip!\n\nProgress:\n- XP Gained: ${xpGained} XP\n- Current Level: Level ${currentLevel}\n- Progress to Next Level: ${xpToNextLevel} XP needed\n\nActivity:\n- Issues Completed: ${issuesCompleted}\n- PRs Merged: ${prsMerged}\n- Reviews Performed: ${reviewsPerformed}\n\n${recommendations.length > 0 ? `Recommended for you:\n${recommendations.map((r) => `- ${r.title} (+${r.xpReward} XP): ${r.url}`).join('\n')}\n\n` : ''}View your dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'https://mergeship.com'}\n\nYou can unsubscribe from these emails by updating your Profile Settings.\n`,
  });
}

export async function sendOrganizationInviteEmail({
  to,
  inviteLink,
  inviterHandle,
  organizationName,
}: {
  to: string;
  inviteLink: string;
  inviterHandle: string;
  organizationName: string;
}) {
  if (!resend) {
    console.warn('RESEND_API_KEY missing, skipping email send');
    return { skipped: true };
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to,
    subject: `[MergeShip] ${inviterHandle} invited you to join ${organizationName}`,
    html: `
      <h2>You've been invited!</h2>
      <p>${inviterHandle} invited you to join <strong>${organizationName}</strong> on MergeShip.</p>
      <p>Click the link below to accept the invitation:</p>
      <p><a href="${inviteLink}">${inviteLink}</a></p>
    `,
  });
}
