import Link from "next/link";
import type { ReactNode } from "react";
import NavLinks from "./NavLinks";

/** Sidebar layout for /app pages. Stacks into a top bar under 860px. */
export default function AppShell({ account, children }: { account: ReactNode; children: ReactNode }) {
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
        <div className="side-foot">{account}</div>
      </aside>
      <main id="main" className="main">
        {children}
      </main>
    </div>
  );
}
