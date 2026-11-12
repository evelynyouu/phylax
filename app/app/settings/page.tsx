import { Suspense } from "react";
import SettingsView from "@/components/settings/SettingsView";
import { avatarObjectPath, avatarSignedUrl } from "@/lib/avatar";
import { loadApp } from "@/lib/app-data";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Settings | Phylax" };

export default function SettingsPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  return (
    <Suspense fallback={<h1 className="display" style={{ fontSize: 44 }}>Settings</h1>}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const { user, store } = await loadApp();
  // Sign the fixed path for this user, never the user-editable metadata value.
  const avatarUrl = await avatarSignedUrl(await supabaseServer(), user.avatarPath ? avatarObjectPath(user.id) : null);
  const gmail = await store.getGmail();
  return <SettingsView user={user} avatarUrl={avatarUrl} gmailEmail={gmail?.gmailEmail ?? null} emailNotice={email ?? null} />;
}
