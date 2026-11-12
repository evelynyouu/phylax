import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
import SettingsView from "../components/settings/SettingsView";
import { NAV } from "../components/NavLinks";
import { authErrorMessage, safeNext } from "../lib/auth-copy";
import { hasPassword, validateName, validateNewEmail } from "../lib/profile";

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
