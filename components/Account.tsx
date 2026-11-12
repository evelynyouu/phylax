import Link from "next/link";
import type { AppUser } from "@/lib/current-user";
import DeleteAccount from "./DeleteAccount";
import DisconnectGmail from "./DisconnectGmail";
import ThemeToggle from "./ThemeToggle";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Sidebar footer: dark mode switch, sync status, who is signed in, sign out, and the privacy and terms links. */
export default function Account({ user, syncNote, demo, connected }: { user: AppUser; syncNote: string; demo: boolean; connected: boolean }) {
  return (
    <>
      <ThemeToggle />
      <p className="sync-note">{syncNote}</p>
      <div className="account">
        <span aria-hidden="true" className="avatar">
          {initials(user.name)}
        </span>
        <span className="account-name" title={user.email}>
          {user.name}
        </span>
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="linkish">
            Sign out
          </button>
        </form>
      </div>
      <p className="fine">
        <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
      </p>
      {!demo && connected && <DisconnectGmail />}
      {!demo && <DeleteAccount />}
    </>
  );
}
