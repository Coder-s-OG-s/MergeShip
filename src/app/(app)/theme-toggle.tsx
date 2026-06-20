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
    <button type="button" onClick={toggle} className="app-sidebar-action">
      {dark ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />}
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
