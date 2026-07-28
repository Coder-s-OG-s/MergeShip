'use client';

import Link from 'next/link';
import { devSkipInstall } from '@/app/actions/dev-skip-install';

type InstallWizardProps = {
  installUrl: string;
  isDevUser?: boolean;
};

export function InstallWizard({ installUrl, isDevUser }: InstallWizardProps) {
  return (
    <div className="hero-bg grid-bg min-h-screen text-white">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="text-xl font-bold">MergeShip</div>
        <Link href="/dev/login" className="text-sm font-medium text-gray-400 hover:text-white">
          Sign in instead
        </Link>
      </header>

      <main className="mx-auto mt-16 max-w-xl px-6">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="mb-4 font-display text-4xl font-bold">One more step</h1>
          <p className="mb-6 text-gray-300">
            MergeShip needs the GitHub App installed on your account so it can track your
            contributions and award XP in real time. Two clicks, no permissions you don&apos;t
            already have on GitHub.
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
            We only ask for read access to your repos and write access on issues you&apos;re working
            on. You can revoke it any time in GitHub settings.
          </p>
        </div>
      </main>
    </div>
  );
}
