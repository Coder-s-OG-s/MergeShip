import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111318] px-6 font-mono text-white">
      <div className="w-full max-w-2xl">
        <p className="mb-6 text-sm tracking-widest text-zinc-500">04 / NOT FOUND</p>

        <h1 className="mb-4 text-6xl font-bold">404</h1>

        <p className="mb-2 text-xl text-zinc-300">PAGE NOT FOUND</p>

        <p className="mb-8 text-zinc-500">The page you are trying to access does not exist.</p>

        <Link
          href="/dashboard"
          className="inline-block border border-zinc-700 px-5 py-3 transition hover:bg-white hover:text-black"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
