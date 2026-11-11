import { Suspense } from "react";
import Account from "@/components/Account";
import AppShell from "@/components/AppShell";
import { GmailNotice } from "@/components/ConnectGmail";
import { loadApp, loadSyncNote } from "@/lib/app-data";

async function AccountSlot() {
  const { user, store, source, connected } = await loadApp();
  return (
    <Account user={user} syncNote={await loadSyncNote(store, source, connected)} demo={source === "fixtures"} connected={connected} />
  );
}

// Reconnect or "not connected" notice, the same on every /app page.
async function GmailNoticeSlot() {
  const { gmail } = await loadApp();
  return <GmailNotice state={gmail} />;
}

// The shell prerenders; the account block and the Gmail notice read the session and stream in.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      account={
        <Suspense fallback={<p className="sync-note">Loading</p>}>
          <AccountSlot />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <GmailNoticeSlot />
      </Suspense>
      {children}
    </AppShell>
  );
}
