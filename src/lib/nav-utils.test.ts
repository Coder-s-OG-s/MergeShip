import { describe, it, expect } from 'vitest';
import { isActiveRoute } from './nav-utils';

describe('isActiveRoute', () => {
  describe('root path', () => {
    it('is active on exact match', () => {
      expect(isActiveRoute('/', '/')).toBe(true);
    });

    it('is not active on any non-root pathname', () => {
      expect(isActiveRoute('/', '/dashboard')).toBe(false);
      expect(isActiveRoute('/', '/dashboard/')).toBe(false);
    });
  });

  describe('exact match', () => {
    it('is active when pathname equals href', () => {
      expect(isActiveRoute('/dashboard', '/dashboard')).toBe(true);
      expect(isActiveRoute('/issues', '/issues')).toBe(true);
      expect(isActiveRoute('/settings/profile', '/settings/profile')).toBe(true);
    });
  });

  describe('true child routes (nested under href)', () => {
    it('is active when pathname is a direct child of href', () => {
      expect(isActiveRoute('/dashboard', '/dashboard/analytics')).toBe(true);
      expect(isActiveRoute('/issues', '/issues/123')).toBe(true);
      expect(isActiveRoute('/settings/profile', '/settings/profile/edit')).toBe(true);
    });

    it('is active when pathname is a deeply nested child of href', () => {
      expect(isActiveRoute('/dashboard', '/dashboard/a/b/c')).toBe(true);
    });
  });

  describe('false positives prevented by trailing-slash guard', () => {
    it('is NOT active when pathname shares a prefix but is not a child route', () => {
      expect(isActiveRoute('/dashboard', '/dashboard-settings')).toBe(false);
      expect(isActiveRoute('/issues', '/issues-list')).toBe(false);
      expect(isActiveRoute('/my-prs', '/my-prs-old')).toBe(false);
    });

    it('is NOT active when sibling settings routes share a common parent prefix', () => {
      // SETTINGS = /settings/profile, USAGE = /settings/usage
      // When on /settings/usage, SETTINGS must NOT be active
      expect(isActiveRoute('/settings/profile', '/settings/usage')).toBe(false);
      // When on /settings/profile, USAGE must NOT be active
      expect(isActiveRoute('/settings/usage', '/settings/profile')).toBe(false);
    });

    it('is NOT active for a different sub-path under the same parent', () => {
      expect(isActiveRoute('/settings/profile', '/settings/usage/billing')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('is NOT active when href is longer than pathname', () => {
      expect(isActiveRoute('/dashboard/analytics', '/dashboard')).toBe(false);
    });

    it('handles trailing slash on href correctly', () => {
      // href with trailing slash: /dashboard/ should match /dashboard/
      expect(isActiveRoute('/dashboard/', '/dashboard/')).toBe(true);
    });
  });
});
