import { Suspense } from "react";
import Account from "@/components/Account";
import AppShell from "@/components/AppShell";
import { loadApp, loadSyncNote } from "@/lib/app-data";

async function AccountSlot() {
  const { user, source } = await loadApp();
  return <Account user={user} syncNote={await loadSyncNote(source)} demo={source === "fixtures"} />;
}

// The shell prerenders; the account block reads the session and streams in.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      account={
        <Suspense fallback={<p className="sync-note">Loading</p>}>
          <AccountSlot />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
