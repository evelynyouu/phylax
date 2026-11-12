import Link from "next/link";
import type { AppUser } from "@/lib/current-user";
import DeleteAccount from "../DeleteAccount";
import DisconnectGmail from "../DisconnectGmail";
import AppearanceSection from "./AppearanceSection";
import EmailSection from "./EmailSection";
import PasswordSection from "./PasswordSection";
import ProfileSection from "./ProfileSection";

export default function SettingsView({ user, avatarUrl, gmailEmail, emailNotice = null }: { user: AppUser; avatarUrl: string | null; gmailEmail: string | null; emailNotice?: string | null }) {
  return (
    <>
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      <div className="settings">
        <ProfileSection user={user} avatarUrl={avatarUrl} />
        <EmailSection user={user} notice={emailNotice} />
        <PasswordSection user={user} />
        <AppearanceSection />
        <section className="card" aria-labelledby="set-gmail">
          <h2 id="set-gmail">Gmail</h2>
          {gmailEmail ? (
            <>
              <p>{gmailEmail}</p>
              <DisconnectGmail />
            </>
          ) : (
            <>
              <p>Gmail not connected</p>
              <Link href="/connect-gmail?next=app" className="btn btn-primary">
                Connect Gmail
              </Link>
            </>
          )}
        </section>
        <section className="card" aria-labelledby="set-delete">
          <h2 id="set-delete">Delete account</h2>
          <p>This deletes your Phylax account and everything it found. Your Gmail is not touched.</p>
          <DeleteAccount />
        </section>
      </div>
    </>
  );
}
