import Link from "next/link";
import type { ReactNode } from "react";

/** Public page frame for a rendered docs/legal file (app/privacy, app/terms). Reuses the sign-up page layout classes. */
export default function LegalPage({ children }: { children: ReactNode }) {
  return (
    <div className="su">
      <header className="su-head">
        <Link href="/" className="brand">
          Phylax
        </Link>
        <p>
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </header>
      <div className="su-body">
        <main className="su-main">
          <article className="stack-16">{children}</article>
        </main>
      </div>
    </div>
  );
}
