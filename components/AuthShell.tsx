import Link from "next/link";
import type { ReactNode } from "react";
import PhylaxMark from "./PhylaxMark";

/**
 * Frame for sign-in, sign-up, Connect Gmail and password reset (SignIn.dc.html, SignUp.dc.html):
 * logo header with a link on the right, soft green glow, one centered white card.
 */
export default function AuthShell({ aside, children, footer, wide = false }: { aside?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div className="auth">
      <header className="auth-head">
        <Link href="/" className="auth-brand">
          <span aria-hidden="true" className="auth-logo">
            <PhylaxMark />
          </span>
          <span>Phylax</span>
        </Link>
        {aside && <p>{aside}</p>}
      </header>
      <main className="auth-main">
        <section className={`auth-card${wide ? " wide" : ""}`}>{children}</section>
        {footer && <div className="auth-after">{footer}</div>}
      </main>
    </div>
  );
}
