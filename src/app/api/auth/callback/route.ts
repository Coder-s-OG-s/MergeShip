import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * Supabase OAuth callback. GitHub redirects here after the user authorizes.
 * Exchange the code for a session, then route them through the install gate.
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
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    url.pathname = '/';
    url.searchParams.delete('code');
    url.searchParams.set('auth_error', error.message);
    return NextResponse.redirect(url);
  }

  url.pathname = next;
  url.search = '';
  return NextResponse.redirect(url);
}
