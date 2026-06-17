import { describe, expect, it } from 'vitest';
import { sendHelpDispatchEmail } from './email';

describe('sendHelpDispatchEmail', () => {
  it('skips sending when resend is not configured', async () => {
    const result = await sendHelpDispatchEmail({
      to: 'test@example.com',
      mentorHandle: 'mentor',
      menteeHandle: 'mentee',
      prUrl: 'https://github.com/test/pr/1',
    });

    expect(result).toEqual({ skipped: true });
  });
});
