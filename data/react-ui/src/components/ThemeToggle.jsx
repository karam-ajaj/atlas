import React, { useEffect, useState } from "react";

function getInitialTheme() {
  try {
    const t = localStorage.getItem("atlas_theme");
    if (t === "dark" || t === "light") return t;
  } catch (e) {}
  // default to dark (matches current design)
  return "dark";
}

export default function ThemeToggle({ theme, setTheme }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const onToggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("atlas_theme", next); } catch (e) {}
    setTheme(next);
  };

  return (
    <button
      onClick={onToggle}
      className="px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600"
      title="Toggle theme"
    >
      {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
