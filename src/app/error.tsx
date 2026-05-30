"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {

  
  useEffect(() => {
    // Log the error to an error reporting service or console to satisfy lint rules
    console.error("Application error captured:", error);
  }, [error]);

  return ( 
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="text-sm text-gray-500">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 text-white transition-colors bg-black rounded hover:bg-gray-800"
      >
        Try Again
      </button>
    </div>
  );
}
