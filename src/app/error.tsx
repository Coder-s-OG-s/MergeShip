"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4">
      <h2 className="text-2xl font-bold">Something went wrong</h2>

      <button
        onClick={() => reset()}
        className="px-4 py-2 rounded bg-black text-white"
      >
        Try Again
      </button>
    </div>
  );
}