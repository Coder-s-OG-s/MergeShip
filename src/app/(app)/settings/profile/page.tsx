import { getServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  // Get authenticated user
  const sb = getServerSupabase();
  if (!sb) return null;

  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser();

  // Redirect to login if not authenticated
  if (authError || !user) {
    redirect('/');
  }

  // Fetch user profile data
  const { data: profile } = await sb
    .from('profiles')
    .select('bio, skills, website_url, twitter_handle')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-3xl">
        {/* Breadcrumb */}
        <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
          Settings / Profile
        </div>

        {/* Page Header */}
        <h1 className="mb-2 font-serif text-3xl text-white">Profile Settings</h1>
        <p className="mb-8 text-sm text-zinc-400">
          Update your bio, skills, and social links to customize your public profile
        </p>

        {/* Profile Form */}
        <div className="border border-[#21262d] bg-[#161b22] p-6">
          <ProfileForm
            initialData={{
              bio: profile?.bio || null,
              skills: profile?.skills || null,
              website_url: profile?.website_url || null,
              twitter_handle: profile?.twitter_handle || null,
            }}
          />
        </div>

        {/* Help Text */}
        <div className="mt-6 border border-[#21262d] bg-[#161b22] p-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-300">Tips:</h3>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li>• Your profile is public and visible to all users</li>
            <li>• Skills help others discover your expertise</li>
            <li>• Add social links to make it easy to connect with you</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Profile Settings | MergeShip',
  description: 'Update your profile information, bio, skills, and social links',
};
