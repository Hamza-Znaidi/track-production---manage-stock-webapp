'use client';

import { useEffect, useState } from 'react';
import { SunDim, Moon } from 'lucide-react';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleToggle = () => {
    setIsPressed(true);
    setTheme(theme === 'dark' ? 'light' : 'dark');
    setTimeout(() => setIsPressed(false), 300);
  };

  const isDark = theme === 'dark';

  return (
    <div className="w-full flex items-center justify-between px-4 py-3">
      <span className="text-sm font-medium text-gray-200 dark:text-gray-500">
        Theme
      </span>
      <button
        type="button"
        onClick={handleToggle}
        className="relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 bg-gray-300 dark:bg-gray-200 active:scale-95"
        aria-label="Toggle light and dark mode"
        title="Toggle theme"
      >
        {/* Toggle circle */}
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-all duration-300 ease-in-out ${
            isDark ? 'translate-x-9' : 'translate-x-1'
          } ${isPressed ? 'scale-90' : 'scale-100'}`}
        >
          <span className={`flex h-full w-full items-center justify-center  transition-transform duration-300 `}>
            {isDark ? <Moon /> : <SunDim className='text-yellow-500' />}
          </span>
        </span>
      </button>
    </div>
  );
}
