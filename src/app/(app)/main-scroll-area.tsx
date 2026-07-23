'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const SHOW_AFTER_PX = 300;

export function MainScrollArea({ children }: { children: React.ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const onScroll = () => setShowButton(el.scrollTop > SHOW_AFTER_PX);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main ref={mainRef} className="relative flex-1 overflow-y-auto">
      {children}

      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        tabIndex={showButton ? 0 : -1}
        className={`fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[#2d333b] bg-[#161b22] text-white shadow-lg transition-all duration-300 ${
          showButton
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </main>
  );
}
