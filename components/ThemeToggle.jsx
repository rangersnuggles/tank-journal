"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "aquaslog-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null); // null until hydrated

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(stored || (systemDark ? "dark" : "light"));
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  }

  if (theme === null) return null;

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 6px",
        color: "var(--color-text-muted)",
        fontSize: "15px",
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        borderRadius: "4px",
        fontFamily: "sans-serif",
      }}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
