import type { AppUser } from "@/lib/current-user";
import DisconnectGmail from "./DisconnectGmail";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Sidebar footer: sync status, who is signed in, and sign out. */
export default function Account({ user, syncNote, demo, connected }: { user: AppUser; syncNote: string; demo: boolean; connected: boolean }) {
  return (
    <>
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
      {!demo && connected && <DisconnectGmail />}
    </>
  );
}
