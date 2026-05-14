/**
 * Community link validation. Pure functions; the actual upsert lives in
 * the server action so the validation can be tested without a DB.
 */

export const COMMUNITY_KINDS = [
  'discord',
  'slack',
  'forum',
  'website',
  'twitter',
  'other',
] as const;

export type CommunityKind = (typeof COMMUNITY_KINDS)[number];

export type ValidateResult = { ok: true; url: string } | { ok: false; reason: string };

const MAX_URL_LENGTH = 500;

export function validateCommunityUrl(url: string, kind: CommunityKind): ValidateResult {
  if (!COMMUNITY_KINDS.includes(kind)) {
    return { ok: false, reason: 'unknown kind' };
  }
  if (typeof url !== 'string' || url.length === 0) {
    return { ok: false, reason: 'url is required' };
  }
  if (url.length > MAX_URL_LENGTH) {
    return { ok: false, reason: `url too long (max ${MAX_URL_LENGTH})` };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'must include a scheme like https://' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: `unsupported scheme: ${parsed.protocol}` };
  }
  return { ok: true, url };
}
