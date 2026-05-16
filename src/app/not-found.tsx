import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#111318] text-white font-mono flex items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-gray-500 tracking-widest">
            04 / NOT FOUND
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            404
          </h1>

          <p className="text-gray-400 text-lg">
            PAGE NOT FOUND
          </p>

          <p className="text-gray-500 max-w-md">
            The page you are looking for does not exist or may have been moved.
          </p>

          <Link
            href="/dashboard"
            className="inline-block border border-gray-700 px-5 py-3 hover:bg-white hover:text-black transition-colors duration-200"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}