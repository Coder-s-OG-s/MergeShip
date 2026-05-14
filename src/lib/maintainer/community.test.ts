import { describe, it, expect } from 'vitest';
import { validateCommunityUrl, COMMUNITY_KINDS, type CommunityKind } from './community';

describe('validateCommunityUrl', () => {
  it.each(COMMUNITY_KINDS)('accepts plain https for %s', (kind) => {
    const res = validateCommunityUrl('https://example.com/abc', kind as CommunityKind);
    expect(res.ok).toBe(true);
  });

  it('accepts http for non-prod links (allows localhost / dev forums)', () => {
    const res = validateCommunityUrl('http://forum.example.com/x', 'forum');
    expect(res.ok).toBe(true);
  });

  it('rejects javascript: scheme', () => {
    const res = validateCommunityUrl('javascript:alert(1)', 'discord');
    expect(res.ok).toBe(false);
  });

  it('rejects data: scheme', () => {
    const res = validateCommunityUrl('data:text/html,<script>', 'website');
    expect(res.ok).toBe(false);
  });

  it('rejects missing scheme', () => {
    const res = validateCommunityUrl('example.com/foo', 'website');
    expect(res.ok).toBe(false);
  });

  it('rejects unknown kind', () => {
    const res = validateCommunityUrl('https://example.com', 'whatsapp' as never);
    expect(res.ok).toBe(false);
  });

  it('rejects too long', () => {
    const res = validateCommunityUrl('https://example.com/' + 'a'.repeat(2048), 'website');
    expect(res.ok).toBe(false);
  });

  it('discord kind prefers a discord-ish host but still accepts others', () => {
    const a = validateCommunityUrl('https://discord.gg/abc', 'discord');
    const b = validateCommunityUrl('https://example.com/chat', 'discord');
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true); // permissive — different orgs use different invite domains
  });
});
