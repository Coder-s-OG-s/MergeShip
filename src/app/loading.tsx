export default function Loading() {
  return (
    <div 
      className="flex min-h-screen items-center justify-center bg-transparent"
      role="status"
      aria-label="Loading page content"
    >
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-b-black" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
