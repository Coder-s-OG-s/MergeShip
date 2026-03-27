import { MaintainerSidebar } from "@/components/layout/MaintainerSidebar";

export default function MaintainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <MaintainerSidebar />
      <main className="flex-1 ml-64">
        {children}
      </main>
    </div>
  );
}
