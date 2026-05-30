export default function Loader() {
  return (
    <div 
      className="flex items-center justify-center p-6"
      role="status"
      aria-label="Loading"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-b-black" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
