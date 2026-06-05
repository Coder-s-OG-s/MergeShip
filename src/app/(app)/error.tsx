'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="app-page flex min-h-[60vh] flex-col items-center justify-center">
      <div className="app-card w-full max-w-md p-10 text-center">
        <p className="app-eyebrow mb-3">System Error</p>
        <h1 className="app-title-sm mb-4">Something went wrong.</h1>
        <p className="app-body mb-8">An unexpected error occurred while loading this page.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="border border-[#2a2a28] px-6 py-3 text-[11px] uppercase tracking-[0.1em] text-[#f2f0eb] transition hover:border-[#3a3a36] hover:bg-[#1a1a18]"
          style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
