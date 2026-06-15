import Link from 'next/link';

type Props = {
  githubConnected: boolean;
  hasClaimedIssue: boolean;
  hasSubmittedPr: boolean;
};

function ChecklistItem({ done, href, label }: { done: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-b border-[#2d333b] py-3 last:border-b-0 hover:text-white"
    >
      <span className="text-sm">{label}</span>
      <span
        className={`text-[10px] font-bold uppercase tracking-widest ${
          done ? 'text-[#10b981]' : 'text-zinc-500'
        }`}
      >
        {done ? 'Done' : 'Pending'}
      </span>
    </Link>
  );
}

export default function OnboardingChecklist({
  githubConnected,
  hasClaimedIssue,
  hasSubmittedPr,
}: Props) {
  return (
    <section className="mb-16 border border-[#2d333b] bg-[#161b22] p-6">
      <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">GET STARTED</div>

      <h2 className="mb-6 font-serif text-2xl text-white">Complete your contributor onboarding</h2>

      <div>
        <ChecklistItem done={githubConnected} href="/settings" label="Connect GitHub account" />

        <ChecklistItem done={hasClaimedIssue} href="/issues" label="Claim your first issue" />

        <ChecklistItem done={hasSubmittedPr} href="/my-prs" label="Submit your first PR" />
      </div>
    </section>
  );
}
