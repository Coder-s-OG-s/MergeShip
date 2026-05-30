export default function Loader() {
  return (
    <div 
      className="flex items-center justify-center p-6"
      role="status"
      aria-label="Loading"

      
    >
      <div className="w-10 h-10 border-2 border-gray-200 rounded-full animate-spin border-b-black" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
