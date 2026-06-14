import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { OnboardingClient } from './onboarding-client';

export const dynamic = 'force-dynamic';

export default async function AnalyzePage() {
  const sb = await getServerSupabase();
  if (!sb) {
    return <DemoRender />;
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const identity = user.identities?.find((i) => i.provider === 'github');
  const avatarUrl = (identity?.identity_data?.['avatar_url'] as string) ?? null;
  const githubHandle = (identity?.identity_data?.['user_name'] as string) ?? null;

  if (!githubHandle) redirect('/');

  const service = getServiceSupabase();
  if (service) {
    const { data: profile } = await service
      .from('profiles')
      .select('audit_completed')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.audit_completed) {
      redirect('/dashboard');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D0E12] px-4">
      <OnboardingClient avatarUrl={avatarUrl} githubHandle={githubHandle} />
    </div>
  );
}

function DemoRender() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D0E12] px-4">
      <OnboardingClient
        avatarUrl="https://avatars.githubusercontent.com/u/90404176?v=4"
        githubHandle="PranavAgarkar07"
      />
    </div>
  );
}
