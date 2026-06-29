'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RepoPicker } from '@/app/onboarding/repos/repo-picker';
import type { RepoPickerRow } from '@/app/actions/maintainer';
import { devSkipInstall } from '@/app/actions/dev-skip-install';

type InstallWizardProps = {
  initialStep: number;
  installUrl: string;
  installationId?: number;
  initialRepos?: RepoPickerRow[];
  isDevUser?: boolean;
};

function clampStep(value: number): 1 | 2 | 3 {
  if (Number.isNaN(value) || value < 1 || value > 3) return 1;
  return value as 1 | 2 | 3;
}

export function InstallWizard({
  initialStep,
  installUrl,
  installationId,
  initialRepos,
  isDevUser,
}: InstallWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(initialStep);

  // Sync state with URL
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      setStep(clampStep(parseInt(stepParam, 10)));
    }
  }, [searchParams]);

  const goToStep = (newStep: number) => {
    setStep(newStep);
    // update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', newStep.toString());
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="hero-bg grid-bg min-h-screen text-white">
      {/* Header with step indicator and sign in link */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="text-xl font-bold">MergeShip</div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center">
                {step > i ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
                    <Check size={14} strokeWidth={3} />
                  </div>
                ) : step === i ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-500/20">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-gray-600" />
                )}
                {i < 3 && <div className="mx-2 h-px w-8 bg-gray-700" />}
              </div>
            ))}
          </div>
          <Link href="/dev/login" className="text-sm font-medium text-gray-400 hover:text-white">
            Sign in instead
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto mt-16 max-w-xl px-6">
        <div className="mb-6 inline-block rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-blue-400">
          STEP {step} OF 3
        </div>

        {step === 1 && <Step1 installUrl={installUrl} isDevUser={isDevUser} />}
        {step === 2 && (
          <Step2
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
            installationId={installationId}
            initialRepos={initialRepos}
          />
        )}
        {step === 3 && <Step3 onBack={() => goToStep(2)} />}
      </main>
    </div>
  );
}

function Step1({ installUrl, isDevUser }: { installUrl: string; isDevUser?: boolean }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="mb-4 font-display text-4xl font-bold">One more step</h1>
      <p className="mb-6 text-gray-300">
        MergeShip needs the GitHub App installed on your account so it can track your contributions
        and award XP in real time. Two clicks, no permissions you don&apos;t already have on GitHub.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link
          href={installUrl}
          className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold"
        >
          Install MergeShip on GitHub
        </Link>

        {isDevUser && (
          <form action={devSkipInstall}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl border border-dashed border-gray-600 px-6 py-3 font-semibold text-gray-400 hover:border-gray-400 hover:text-white"
            >
              Skip Installation (Development Only)
            </button>
          </form>
        )}
      </div>

      <p className="mt-8 text-sm text-gray-500">
        We only ask for read access to your repos and write access on issues you&apos;re working on.
        You can revoke it any time in GitHub settings.
      </p>
    </div>
  );
}

function Step2({
  onNext,
  onBack,
  installationId,
  initialRepos,
}: {
  onNext: () => void;
  onBack: () => void;
  installationId?: number;
  initialRepos?: RepoPickerRow[];
}) {
  if (!installationId || !initialRepos) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="mb-4 font-display text-4xl font-bold">Select Repositories</h1>
        <p className="mb-6 text-gray-300">Please complete the GitHub installation first.</p>
        <button
          onClick={onBack}
          className="rounded-xl border border-gray-600 px-6 py-3 font-semibold text-gray-300 hover:bg-white/5"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="rounded-xl border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-white/5"
        >
          Back
        </button>
      </div>
      <RepoPicker installationId={installationId} initialRepos={initialRepos} onNext={onNext} />
    </div>
  );
}

function Step3({ onBack }: { onBack: () => void }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="mb-4 font-display text-4xl font-bold">You&apos;re all set</h1>
      <p className="mb-6 text-gray-300">Your repositories have been successfully configured.</p>

      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-xl border border-gray-600 px-6 py-3 font-semibold text-gray-300 hover:bg-white/5"
        >
          Back
        </button>
        <Link href="/onboarding/analyze" className="btn-primary rounded-xl px-6 py-3 font-semibold">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
