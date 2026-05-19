'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111318] px-6 text-white">
      <div className="w-full max-w-md border border-[#2d333b] bg-[#161b22] p-10 text-center">
        <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
          System Error
        </div>

        <h1 className="mb-4 font-serif text-3xl">Something went wrong.</h1>

        <p className="mb-8 text-sm leading-6 text-zinc-400">
          An unexpected error occurred while loading this page.
        </p>

        <button
          onClick={() => reset()}
          className="border border-zinc-700 px-6 py-3 text-[11px] uppercase tracking-[0.25em] text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
