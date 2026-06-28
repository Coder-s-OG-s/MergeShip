import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(_req: Request) {
  try {
    const sb = await getServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = getServiceSupabase();

    if (!service) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { data: profile, error } = await service
      .from('profiles')
      .select('github_stats_synced_at')
      .eq('id', user.id)
      .single();

    if (!profile?.github_stats_synced_at) {
      return NextResponse.json({
        status: 'pending',
      });
    }

    return NextResponse.json({
      status: 'completed',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
