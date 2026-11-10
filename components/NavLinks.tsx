"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </>
  ),
  recurring: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v5h-5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  bills: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
};

export const NAV = [
  { href: "/app", label: "Dashboard", icon: "dashboard" },
  { href: "/app/recurring", label: "Recurring", icon: "recurring" },
  { href: "/app/calendar", label: "Calendar", icon: "calendar" },
  { href: "/app/bills", label: "Bills and deadlines", icon: "bills" },
] as const;

export default function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="App" className="side-nav">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            {ICONS[n.icon]}
          </svg>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
