import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { bootstrapProfile } from '@/app/actions/profile';

/**
 * Supabase OAuth callback. GitHub redirects here after the user authorizes.
 * Exchange the code for a session, bootstrap the profile row so the install
 * webhook can link itself to a user, then route through the install gate.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/onboarding';

  if (!code) {
    url.pathname = '/';
    url.search = '?auth_error=missing_code';
    return NextResponse.redirect(url);
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'auth not configured' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    url.pathname = '/';
    url.searchParams.delete('code');
    url.searchParams.set('auth_error', error.message);
    return NextResponse.redirect(url);
  }

  // Mirror the user into profiles right away so subsequent webhook deliveries
  // (installation.created) can resolve account_login → user_id. Failure here
  // does not block the redirect — the user will see a non-fatal error state
  // and can retry from /install.
  await bootstrapProfile().catch(() => {});

  url.pathname = next;
  url.search = '';
  return NextResponse.redirect(url);
}
