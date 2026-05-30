/**
 * Determines whether a nav item should be marked as active given the current
 * pathname.
 *
 * Rules:
 * - The root path ('/') is active only on an exact match.
 * - Any other href is active when:
 *   a) the pathname exactly equals the href, OR
 *   b) the pathname starts with `${href}/` (true nested child route).
 *
 * The trailing-slash requirement in (b) prevents false positives where one
 * route is a non-nested prefix of another:
 *   href='/dashboard', pathname='/dashboard-settings'
 *   --> NOT active (no trailing slash after '/dashboard')
 *
 *   href='/dashboard', pathname='/dashboard/analytics'
 *   --> active (true nested child)
 */
export function isActiveRoute(href: string, pathname: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
