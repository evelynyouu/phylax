// Shared with the inline script in app/layout.tsx, which applies the saved theme before first paint.
export const THEME_KEY = "phylax-theme";

export type Theme = "light" | "dark";

/** The theme lives on <html data-theme>, so everything reads it from there. */
export function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  root.classList.add("theming");
  if (t === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  window.setTimeout(() => root.classList.remove("theming"), 400);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    // Storage blocked: the theme still applies for this page view.
  }
}

/** For useSyncExternalStore: calls onChange whenever data-theme changes. */
export function subscribeTheme(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
