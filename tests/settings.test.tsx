import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
import SettingsView from "../components/settings/SettingsView";
import { NAV } from "../components/NavLinks";
import { authErrorMessage, safeNext } from "../lib/auth-copy";
import { hasPassword, validateName, validateNewEmail } from "../lib/profile";
import { appUserFrom } from "../lib/current-user";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const emailUser = { id: "u", email: "a@b.co", name: "Evelyn You", avatarPath: null, providers: ["email"] };
const googleUser = { ...emailUser, providers: ["google"] };

describe("profile validation", () => {
  it("validates names", () => {
    const err = "Enter a name up to 80 characters.";
    expect(validateName("  ")).toBe(err);
    expect(validateName("Evelyn You")).toBeNull();
    expect(validateName("x".repeat(81))).toBe(err);
    expect(validateName("x".repeat(80))).toBeNull();
  });
  it("rejects an unchanged or invalid email", () => {
    expect(validateNewEmail("a@b.co", "A@B.co")).toBe("That is already your email.");
    expect(validateNewEmail("a@b.co", "nope")).not.toBeNull();
    expect(validateNewEmail("a@b.co", "c@d.co")).toBeNull();
  });
  it("hasPassword follows the email provider", () => {
    expect(hasPassword(emailUser)).toBe(true);
    expect(hasPassword(googleUser)).toBe(false);
  });
});

describe("auth copy and routing", () => {
  it("maps email_exists", () => {
    expect(authErrorMessage("", "email_exists")).toBe("An account with that email already exists. Sign in instead.");
  });
  it("lists Settings and allows it as a next path", () => {
    expect(NAV).toContainEqual(expect.objectContaining({ href: "/app/settings", label: "Settings" }));
    expect(safeNext("/app/settings")).toBe("/app/settings");
  });
});

describe("SettingsView", () => {
  it("renders every section for an email user", () => {
    const out = html(<SettingsView user={emailUser} avatarUrl={null} gmailEmail={null} />);
    for (const h of ["Profile", "Email", "Password", "Appearance", "Gmail", "Delete account"]) expect(out).toContain(`>${h}</h2>`);
    expect(out).toContain("Current password");
    expect(out).toContain("Send verification");
    expect(out).toContain("Gmail not connected");
    expect(out).not.toContain("Remove photo");
  });
  it("offers Set a password to a Google-only user", () => {
    const out = html(<SettingsView user={googleUser} avatarUrl="https://x.test/a.png" gmailEmail="g@gmail.com" />);
    expect(out).toContain("Set a password");
    expect(out).not.toContain("Current password");
    expect(out).toContain("You sign in with Google, so your email comes from your Google account.");
    expect(out).toContain("Remove photo");
    expect(out).toContain("g@gmail.com");
  });
});

describe("email change notices", () => {
  it("shows the pending and changed messages in the Email card", () => {
    const pending = html(<SettingsView user={emailUser} avatarUrl={null} gmailEmail={null} emailNotice="pending" />);
    expect(pending).toContain("One link confirmed. Open the link sent to your other address to finish.");
    const changed = html(<SettingsView user={emailUser} avatarUrl={null} gmailEmail={null} emailNotice="changed" />);
    expect(changed).toContain("Your email is updated.");
    expect(html(<SettingsView user={emailUser} avatarUrl={null} gmailEmail={null} emailNotice="bogus" />)).not.toContain("Your email is updated.");
  });
  it("shows the check message when the link was opened on another device", () => {
    const check = html(<SettingsView user={emailUser} avatarUrl={null} gmailEmail={null} emailNotice="check" />);
    expect(check).toContain('<p role="status">If you opened the link on another device, your email may already be changed. Sign in again to see it.</p>');
  });
});

describe("display name", () => {
  const u = (meta: Record<string, unknown>, email = "jo@x.co") =>
    ({ id: "u", email, user_metadata: meta, app_metadata: { provider: "email" } }) as unknown as Parameters<typeof appUserFrom>[0];
  it("prefers the name chosen in Settings over the one Google writes", () => {
    expect(appUserFrom(u({ display_name: "Evelyn", full_name: "Evelyn Google", name: "E G" })).name).toBe("Evelyn");
  });
  it("falls back to full_name, then name, then the email prefix, ignoring blank and non-string values", () => {
    expect(appUserFrom(u({ display_name: "  ", full_name: "Full Name" })).name).toBe("Full Name");
    expect(appUserFrom(u({ display_name: 42, full_name: null, name: "Nick" })).name).toBe("Nick");
    expect(appUserFrom(u({ display_name: { a: 1 }, full_name: ["x"] })).name).toBe("jo");
  });
  it("Settings saves the name as display_name, which Google sign-in does not overwrite", () => {
    const src = readFileSync(join(process.cwd(), "components/settings/ProfileSection.tsx"), "utf8");
    expect(src).toContain("data: { display_name: name.trim() }");
    expect(src).not.toContain("full_name");
  });
});
