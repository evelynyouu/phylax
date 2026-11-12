"use client";

import { useSyncExternalStore } from "react";

// Shared with the inline script in app/layout.tsx, which applies the saved theme before first paint.
export const THEME_KEY = "phylax-theme";

// The theme lives on <html data-theme>, so the switch reads it from there.
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";

/** Sidebar "Dark mode" switch, from the final screen designs. Remembered in this browser only. */
export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = !dark;
    const root = document.documentElement;
    root.classList.add("theming");
    if (next) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    window.setTimeout(() => root.classList.remove("theming"), 400);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // Storage blocked: the switch still works for this page view.
    }
  }

  return (
    <button type="button" className="tswitch" role="switch" aria-checked={dark} onClick={toggle}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        {dark ? (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
      Dark mode
      <span className="trk" aria-hidden="true">
        <span className="knb" />
      </span>
    </button>
  );
}
