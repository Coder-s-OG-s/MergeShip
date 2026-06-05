import { getServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  // Get authenticated user
  const sb = await getServerSupabase();
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
    <div className="app-page mx-auto max-w-3xl">
      <header className="app-page-header">
        <div>
          <p className="app-eyebrow">Settings / Profile</p>
          <h1 className="app-title-sm">Profile Settings</h1>
          <p className="app-lead mt-4">
            Update your bio, skills, and social links to customize your public profile
          </p>
        </div>
      </header>

      <div className="app-card p-6">
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
      <div className="app-card mt-6 p-4">
        <h3 className="mb-2 text-sm font-medium text-[#f2f0eb]">Tips:</h3>
        <ul className="app-body space-y-1 text-sm">
          <li>• Your profile is public and visible to all users</li>
          <li>• Skills help others discover your expertise</li>
          <li>• Add social links to make it easy to connect with you</li>
        </ul>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Profile Settings | MergeShip',
  description: 'Update your profile information, bio, skills, and social links',
};
