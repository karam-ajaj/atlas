import React from 'react';
import useTheme from '../theme/useTheme';

export default function ThemeToggle({ className = '' }) {
  const { mode, toggle, setSystem } = useTheme();

  const label =
    mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : 'System';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} title="Theme">
      <button
        type="button"
        onClick={toggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setSystem();
        }}
        className="px-3 py-2 rounded border border-gray-300 bg-white text-gray-800
                   hover:bg-gray-50 active:bg-gray-100
                   dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600
                   dark:hover:bg-gray-700 dark:active:bg-gray-700"
      >
        {label}
      </button>
    </div>
  );
}