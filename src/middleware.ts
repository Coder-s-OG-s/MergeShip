import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Middleware:
 *   1. Refresh Supabase session cookie on every request (required for SSR auth).
 *   2. Enforce the install gate — signed-in users without a GitHub App install
 *      get redirected to /install, except on a small allowlist.
 *
 * Routes that bypass the gate:
 *   - / (landing page)
 *   - /install (the gate page itself)
 *   - /api/auth/* (OAuth flow)
 *   - /api/webhooks/* (no user session)
 *   - /dev/* (dev-only seeded personas)
 *   - /_next/* and static assets
 */

const GATE_BYPASS_PREFIXES = [
  '/install',
  '/api/auth',
  '/api/webhooks',
  '/api/inngest',
  '/dev',
  '/_next',
  '/favicon',
];

function shouldBypassGate(pathname: string): boolean {
  if (pathname === '/') return true;
  return GATE_BYPASS_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value } of toSet) req.cookies.set(name, value);
          for (const { name, value, options } of toSet) res.cookies.set(name, value, options);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  // Not signed in: let public routes through; everything else bounces to landing.
  if (!user) {
    if (shouldBypassGate(pathname)) return res;
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Signed in: check the install gate unless bypassed.
  if (shouldBypassGate(pathname)) return res;

  const { data: install } = await supabase
    .from('github_installations')
    .select('id')
    .eq('user_id', user.id)
    .is('uninstalled_at', null)
    .maybeSingle();

  if (!install) {
    const url = req.nextUrl.clone();
    url.pathname = '/install';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   - static files (_next/static, _next/image, favicon)
     *   - public files in /public
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
