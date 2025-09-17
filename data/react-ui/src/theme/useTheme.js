import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'atlas-theme'; // 'light' | 'dark' | 'system'

function applyTheme(mode) {
  const root = document.documentElement; // <html>
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && systemDark);
  root.classList.toggle('dark', isDark);
}

export default function useTheme() {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'system';
  });

  useEffect(() => {
    applyTheme(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // Keep in sync with system changes if user chose 'system'
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      if (mode === 'system') applyTheme('system');
    };
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setSystem = useCallback(() => setMode('system'), []);

  return { mode, setMode, toggle, setSystem };
}