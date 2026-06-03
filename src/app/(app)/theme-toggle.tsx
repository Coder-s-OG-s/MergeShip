'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('ms-theme');
    const isDark = stored ? stored === 'dark' : true;
    setDark(isDark);
    document.documentElement.setAttribute('data-ms-theme', isDark ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('ms-theme', next ? 'dark' : 'light');
    document.documentElement.setAttribute('data-ms-theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-3 text-[13px] tracking-widest text-zinc-400 transition-colors hover:text-white"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {dark ? 'LIGHT MODE' : 'DARK MODE'}
    </button>
  );
}
