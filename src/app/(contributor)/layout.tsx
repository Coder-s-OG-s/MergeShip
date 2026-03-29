import { ContributorSidebar } from "@/components/layout/ContributorSidebar";

export default function ContributorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0D0D15]">
      <ContributorSidebar />
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
