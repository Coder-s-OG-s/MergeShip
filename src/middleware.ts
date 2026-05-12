import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { readSupabaseEnv } from '@/lib/supabase/env';

/**
 * Middleware:
 *   1. Refresh Supabase session cookie on every request (required for SSR auth).
 *   2. Enforce the install gate — signed-in users without a GitHub App install
 *      get redirected to /install, except on a small allowlist.
 *
 * If Supabase env is not configured (e.g. preview deploy without secrets), fall
 * through with no auth — the app stays renderable, only protected routes 404.
 *
 * Routes that bypass the gate:
 *   /, /install, /api/auth/*, /api/webhooks/*, /api/inngest, /dev/*, /_next/*
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
  // Public profile pages — /@username — open to anyone.
  if (pathname.startsWith('/@')) return true;
  return GATE_BYPASS_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const env = readSupabaseEnv();
  if (!env) {
    // No Supabase configured — let the request through. The landing page renders;
    // anything that needs auth will show its own "not configured" state.
    return res;
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
        for (const { name, value } of toSet) req.cookies.set(name, value);
        for (const { name, value, options } of toSet) res.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  if (!user) {
    if (shouldBypassGate(pathname)) return res;
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

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
