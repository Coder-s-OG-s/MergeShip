import { describe, expect, it } from 'vitest';
import { htmlEscape, sendHelpDispatchEmail } from './email';

describe('htmlEscape', () => {
  it('escapes & < > " and \'', () => {
    expect(htmlEscape('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes ampersands first to avoid double-encoding', () => {
    expect(htmlEscape('a&b')).toBe('a&amp;b');
  });

  it('escapes single quotes', () => {
    expect(htmlEscape("it's")).toBe('it&#39;s');
  });

  it('passes through safe strings unchanged', () => {
    expect(htmlEscape('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(htmlEscape('')).toBe('');
  });
});

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
