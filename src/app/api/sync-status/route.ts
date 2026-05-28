import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const service = getServiceSupabase();

    if (!service) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { data: profile, error } = await service
      .from('profiles')
      .select('github_stats_synced_at')
      .eq('id', userId)
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
