'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { Check, MoreHorizontal } from 'lucide-react';

type StepStatus = 'pending' | 'active' | 'completed';

interface GitHubData {
  repos: number | null;
  prs: number | null;
  issues: number | null;
}

export default function AnalyzingPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [data, setData] = useState<GitHubData>({ repos: null, prs: null, issues: null });
  const [currentStep, setCurrentStep] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      const sb = getBrowserSupabase();
      if (!sb) return;

      const { data: authData } = await sb.auth.getUser();
      if (!authData.user) {
        router.push('/login');
        return;
      }

      const meta = authData.user.user_metadata;
      const userHandle = meta?.user_name || meta?.preferred_username || '';
      const avatar = meta?.avatar_url || '';

      if (isMounted) {
        setUsername(userHandle);
        setAvatarUrl(avatar);
      }

      // Fetch from GitHub
      if (userHandle) {
        try {
          // Fetch user profile for repos
          const userRes = await fetch(`https://api.github.com/users/${userHandle}`);
          const userData = await userRes.json();
          if (isMounted && userData.public_repos !== undefined) {
            setData((prev) => ({ ...prev, repos: userData.public_repos }));
          }

          // Move to next step after a bit
          setTimeout(() => isMounted && setCurrentStep(1), 1500);

          // Fetch PRs
          const prRes = await fetch(
            `https://api.github.com/search/issues?q=type:pr+author:${userHandle}`,
          );
          const prData = await prRes.json();
          if (isMounted && prData.total_count !== undefined) {
            setData((prev) => ({ ...prev, prs: prData.total_count }));
          }

          setTimeout(() => isMounted && setCurrentStep(2), 3000);

          // Fetch Issues
          const issueRes = await fetch(
            `https://api.github.com/search/issues?q=type:issue+author:${userHandle}`,
          );
          const issueData = await issueRes.json();
          if (isMounted && issueData.total_count !== undefined) {
            setData((prev) => ({ ...prev, issues: issueData.total_count }));
          }

          setTimeout(() => isMounted && setCurrentStep(3), 4500);

          // Calculate level (mocked calculation time)
          setTimeout(() => isMounted && setCurrentStep(4), 7000);

          // Redirect
          setTimeout(() => {
            if (isMounted) router.push('/dashboard');
          }, 8500);
        } catch (e) {
          console.error('Failed to fetch GitHub stats', e);
          // Fallback to progress anyway so user isn't stuck
          setTimeout(() => isMounted && setCurrentStep(1), 1500);
          setTimeout(() => isMounted && setCurrentStep(2), 3000);
          setTimeout(() => isMounted && setCurrentStep(3), 4500);
          setTimeout(() => isMounted && setCurrentStep(4), 7000);
          setTimeout(() => {
            if (isMounted) router.push('/dashboard');
          }, 8500);
        }
      } else {
        // Fallback progress if no username
        setTimeout(() => isMounted && setCurrentStep(1), 1000);
        setTimeout(() => isMounted && setCurrentStep(2), 2000);
        setTimeout(() => isMounted && setCurrentStep(3), 3000);
        setTimeout(() => isMounted && setCurrentStep(4), 4000);
        setTimeout(() => isMounted && router.push('/dashboard'), 5000);
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const getStatus = (stepIndex: number): StepStatus => {
    if (currentStep > stepIndex) return 'completed';
    if (currentStep === stepIndex) return 'active';
    return 'pending';
  };

  const getLevel = () => {
    if (data.prs === null) return '';
    if (data.prs > 20) return 'L3';
    if (data.prs > 5) return 'L2';
    if (data.prs > 0) return 'L1';
    return 'L0';
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#0d1117] pt-24 font-mono text-sm">
      {/* Avatar Container */}
      <div className="relative mb-6">
        {/* Animated gradient ring */}
        <div
          className="absolute inset-[-4px] animate-[spin_3s_linear_infinite] rounded-full bg-gradient-to-r from-purple-600 to-blue-500"
          style={{
            maskImage: 'linear-gradient(transparent, transparent), linear-gradient(white, white)',
            maskClip: 'padding-box, border-box',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            padding: '2px',
            backgroundClip: 'content-box, border-box',
          }}
        />

        <div className="relative z-10 h-20 w-20 overflow-hidden rounded-full border border-zinc-800 bg-[#161b22] p-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-full w-full rounded-full object-cover" />
          ) : (
            <div className="h-full w-full animate-pulse rounded-full bg-zinc-800" />
          )}
        </div>
      </div>

      {/* Username */}
      <div className="mb-8 rounded-full border border-zinc-800 bg-[#1c2128] px-4 py-1.5 font-mono text-[13px] text-zinc-300">
        {username ? `@${username}` : 'Loading...'}
      </div>

      <h2 className="mb-10 font-sans text-[15px] tracking-wide text-zinc-300">
        Analysing your GitHub profile...
      </h2>

      {/* Steps Card */}
      <div className="relative w-full max-w-[500px] rounded-xl border border-zinc-800 bg-[#161b22]/50 p-6 shadow-2xl">
        <div className="space-y-5">
          {/* Step 0: Repos */}
          <div className="flex items-center gap-4">
            <StepIcon status={getStatus(0)} />
            <div className="flex flex-1 items-center justify-between text-[13px]">
              <span className={getStatus(0) === 'pending' ? 'text-zinc-600' : 'text-zinc-300'}>
                Reading public repositories...
              </span>
              {getStatus(0) === 'completed' && data.repos !== null && (
                <span className="text-zinc-400">{data.repos} found</span>
              )}
            </div>
          </div>

          {/* Step 1: PRs */}
          <div className="flex items-center gap-4">
            <StepIcon status={getStatus(1)} />
            <div className="flex flex-1 items-center justify-between text-[13px]">
              <span className={getStatus(1) === 'pending' ? 'text-zinc-600' : 'text-zinc-300'}>
                Scanning pull request history...
              </span>
              {getStatus(1) === 'completed' && data.prs !== null && (
                <span className="text-zinc-400">{data.prs} PRs</span>
              )}
            </div>
          </div>

          {/* Step 2: Issues */}
          <div className="flex items-center gap-4">
            <StepIcon status={getStatus(2)} />
            <div className="flex flex-1 items-center justify-between text-[13px]">
              <span className={getStatus(2) === 'pending' ? 'text-zinc-600' : 'text-zinc-300'}>
                Checking issue activity...
              </span>
              {getStatus(2) === 'completed' && data.issues !== null && (
                <span className="text-zinc-400">{data.issues} Issues</span>
              )}
            </div>
          </div>

          {/* Step 3: Level Calculation */}
          <div className="flex items-center gap-4">
            <StepIcon status={getStatus(3)} />
            <div className="flex flex-1 items-center justify-between text-[13px]">
              <span
                className={
                  getStatus(3) === 'pending'
                    ? 'text-zinc-600'
                    : getStatus(3) === 'active'
                      ? 'text-purple-400'
                      : 'text-zinc-300'
                }
              >
                Calculating contributor level...
              </span>
              {getStatus(3) === 'completed' && (
                <span className="font-bold text-green-400">{getLevel()}</span>
              )}
            </div>
          </div>

          {/* Step 4: Finalizing */}
          <div className="flex items-center gap-4">
            <StepIcon status={getStatus(4)} />
            <div className="flex-1 text-[13px]">
              <span className={getStatus(4) === 'pending' ? 'text-zinc-600' : 'text-zinc-300'}>
                Preparing your dashboard...
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-12 font-sans text-sm text-zinc-600">This takes about 10 seconds</p>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
        <Check className="h-4 w-4 text-green-500" />
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-purple-500 bg-purple-500/10">
        <MoreHorizontal className="h-3 w-3 animate-pulse text-purple-400" />
      </div>
    );
  }

  // pending
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-800" />
  );
}
