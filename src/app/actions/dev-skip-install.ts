'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function devSkipInstall() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development-only action');
  }

  const cookieStore = await cookies();
  cookieStore.set('dev_skip_install', '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 3600,
  });

  redirect('/dashboard');
}

export async function clearDevSkipInstall() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set('dev_skip_install', '', {
    path: '/',
    maxAge: 0,
  });
}
