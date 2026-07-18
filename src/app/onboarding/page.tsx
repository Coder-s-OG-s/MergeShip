import Link from 'next/link';

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[#0D0E12] px-6 py-6 text-white">
      <section className="mx-auto max-w-5xl text-center">
        <div className="mx-auto w-fit rounded-full border border-zinc-800 px-4 py-2 text-xs tracking-[0.25em] text-zinc-400">
          WELCOME TO MERGESHIP
        </div>

        <h1 className="mt-6 text-4xl font-bold md:text-5xl">How are you joining?</h1>

        <p className="mt-4 text-zinc-400">Pick your path to streamline your open-source journey.</p>

        <div className="mt-14 grid gap-6 text-left md:grid-cols-2">
          <div className="rounded-md border border-emerald-900/70 bg-black/20 p-8">
            <div className="relative mb-8 flex h-40 items-center justify-center rounded border border-zinc-800 bg-zinc-900/60">
              <span className="absolute left-4 top-4 border border-emerald-500/40 px-2 py-1 text-[10px] text-[#00FF87]">
                FIRST PR
              </span>
              <span className="text-4xl text-zinc-500">▸_</span>
              <span className="absolute bottom-5 right-5 border border-emerald-500/40 px-2 py-1 text-[10px] text-[#00FF87]">
                +50 XP
              </span>
            </div>

            <p className="text-xs font-semibold tracking-widest text-[#00FF87]">FOR CONTRIBUTORS</p>
            <h2 className="mt-4 text-2xl font-bold">I want to contribute</h2>

            <p className="mt-3 leading-7 text-zinc-400">
              Get a structured path into open source. Find mentored issues, track your impact, and
              build your profile.
            </p>

            <ul className="mt-6 space-y-4 text-zinc-300">
              <li>✓ Match with mentored issues</li>
              <li>✓ Step-by-step PR guidance</li>
              <li>✓ Build a verified portfolio</li>
            </ul>

            <Link
              href="/dashboard"
              className="mt-8 block w-full rounded bg-[#00FF87] px-5 py-4 text-center font-medium text-black"
            >
              Continue as Contributor →
            </Link>
          </div>

          <div className="rounded-md border border-zinc-800 bg-black/20 p-8">
            <div className="relative mb-8 flex h-40 items-center justify-center rounded border border-zinc-800 bg-zinc-900/60">
              <span className="absolute right-4 top-4 border border-red-400/30 px-2 py-1 text-[10px] text-red-200">
                AI FLAGGED
              </span>
              <span className="text-4xl text-zinc-500">▦+</span>
              <span className="absolute bottom-5 left-5 border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400">
                -74% NOISE
              </span>
            </div>

            <p className="text-xs font-semibold tracking-widest text-zinc-500">FOR MAINTAINERS</p>
            <h2 className="mt-4 text-2xl font-bold">I maintain a project</h2>

            <p className="mt-3 leading-7 text-zinc-400">
              Connect your org and get a smart PR queue. Reduce noise, onboard contributors faster,
              and ship clean code.
            </p>

            <ul className="mt-6 space-y-4 text-zinc-300">
              <li>✓ Automated PR triaging</li>
              <li>✓ AI-assisted code reviews</li>
              <li>✓ Contributor analytics</li>
            </ul>

            <Link
              href="/maintainer"
              className="mt-8 block w-full rounded border border-zinc-700 px-5 py-4 text-center font-medium text-white"
            >
              Continue as Maintainer →
            </Link>
          </div>
        </div>

        <p className="mt-8 text-sm text-zinc-500">
          Not sure?{' '}
          <Link href="/dashboard" className="text-[#00FF87]">
            Start as a contributor.
          </Link>
        </p>
      </section>
    </main>
  );
}
