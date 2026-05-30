export default function Loading() {
  return (
    <div 
      className="flex items-center justify-center min-h-screen bg-transparent"
      role="status"
      aria-label="Loading page content"
    >
      <div className="w-12 h-12 border-2 border-gray-200 rounded-full animate-spin border-b-black" />
      
      <span className="sr-only">Loading...</span>
    </div>
  );
}
