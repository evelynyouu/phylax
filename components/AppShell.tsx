import Link from "next/link";
import type { ReactNode } from "react";
import NavLinks from "./NavLinks";

export interface ShellUser {
  name: string;
  email: string | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Sidebar layout for /app pages. Stacks into a top bar under 860px. */
export default function AppShell({
  user,
  syncNote,
  children,
}: {
  user: ShellUser;
  syncNote: string | null;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="side">
        <Link href="/" className="side-brand">
          Subwatch
        </Link>
        <NavLinks />
        <div className="side-foot">
          {syncNote && <p className="sync-note">{syncNote}</p>}
          <div className="account">
            <span aria-hidden="true" className="avatar">
              {initials(user.name)}
            </span>
            <span className="account-name" title={user.email ?? undefined}>
              {user.name}
            </span>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="linkish">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main id="main" className="main">
        {children}
      </main>
    </div>
  );
}
