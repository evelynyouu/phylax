import { Suspense } from "react";
import Account from "@/components/Account";
import AppShell from "@/components/AppShell";
import { GmailNotice } from "@/components/ConnectGmail";
import { avatarObjectPath, avatarSignedUrl } from "@/lib/avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { loadApp, loadSyncNote } from "@/lib/app-data";

async function AccountSlot() {
  const { user, store, connected } = await loadApp();
  // Sign the fixed path for this user, never the user-editable metadata value.
  const avatarUrl = await avatarSignedUrl(await supabaseServer(), user.avatarPath ? avatarObjectPath(user.id) : null);
  return (
    <Account user={user} syncNote={await loadSyncNote(store, connected)} avatarUrl={avatarUrl} />
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
