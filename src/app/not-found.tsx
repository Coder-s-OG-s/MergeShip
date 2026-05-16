import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#111318] text-white font-mono flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <p className="mb-6 text-sm tracking-widest text-zinc-500">
          04 / NOT FOUND
        </p>

        <h1 className="text-6xl font-bold mb-4">404</h1>

        <p className="text-xl text-zinc-300 mb-2">
          PAGE NOT FOUND
        </p>

        <p className="text-zinc-500 mb-8">
          The page you are trying to access does not exist.
        </p>

        <Link
          href="/dashboard"
          className="inline-block border border-zinc-700 px-5 py-3 hover:bg-white hover:text-black transition"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}