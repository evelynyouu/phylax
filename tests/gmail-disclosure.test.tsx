import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CONNECT_HREF } from "../components/ConnectGmail";
import GmailDisclosure from "../components/GmailDisclosure";
import { googleConsentHref } from "../lib/auth-copy";
import { gate } from "../lib/gate";
import { config as proxyConfig } from "../proxy";

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(rel);
    return /\.(tsx?|jsx?)$/.test(e.name) ? [rel] : [];
  });
}

describe("Gmail disclosure before Google's consent screen", () => {
  it("states what Subwatch will and can't do, and what it keeps", () => {
    const html = renderToStaticMarkup(<GmailDisclosure />).replace(/&#x27;/g, "'");
    for (const s of [
      "Subwatch will",
      "Subwatch can't",
      "Send, delete, label or archive mail",
      "Subwatch won't",
      "Store the text of your emails",
      "When you sync, Subwatch reads the sender, subject, text and links of emails that look like billing, including some promotions, from about the last 13 months.",
      "It keeps the merchant, amount, currency, billing cycle, dates and cancel link from billing emails, plus each checked email's Gmail ID, date and type so it is not read twice.",
      "It also keeps your Gmail address and an encrypted Google access token until you disconnect.",
      "Records stay until you delete your account. Disconnecting removes the Google token but keeps your records.",
      "Subwatch never uses your emails for ads or AI training.",
      "Your emails are processed only on Subwatch's own server, hosted by Vercel.",
      "What Subwatch keeps is saved in its database, hosted by Supabase.",
      "You can disconnect or delete your account at any time.",
    ]) {
      expect(html).toContain(s);
    }
    expect(html).not.toMatch(/\u2014/);
    expect(html).not.toContain("can't</h2><ul><li>Store");
    expect(html).toMatch(/<a[^>]*href="\/privacy"[^>]*>Read the Privacy Policy<\/a>/);
  });

  it("sends Continue to Google to the OAuth route with only a known next label", () => {
    expect(googleConsentHref("signup")).toBe("/api/auth/google?next=signup");
    expect(googleConsentHref("app")).toBe("/api/auth/google?next=app");
    for (const bad of [undefined, "", "https://evil.example", ["signup", "app"]]) expect(googleConsentHref(bad)).toBe("/api/auth/google?next=app");
  });

  it("in-app Connect and Reconnect buttons go to the disclosure page, not straight to Google", () => {
    expect(CONNECT_HREF).toBe("/connect-gmail?next=app");
  });

  it("only the disclosure page and sign-up step 2 link to /api/auth/google", () => {
    // Route handlers under app/api are the OAuth flow itself, not links to it. googleConsentHref
    // builds the same link, so using it counts as linking.
    const files = [...sourceFiles("components"), ...sourceFiles("app").filter((f) => !f.startsWith(path.join("app", "api")))];
    const linking = files
      .filter((f) => /\/api\/auth\/google|googleConsentHref/.test(fs.readFileSync(path.join(ROOT, f), "utf8")))
      .sort();
    expect(linking).toEqual([path.join("app", "connect-gmail", "page.tsx"), path.join("app", "signup", "page.tsx")]);
  });

  it("sign-up step 2 and the disclosure page share the one disclosure component", () => {
    for (const f of ["app/signup/page.tsx", "app/connect-gmail/page.tsx"]) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      expect(src).toContain("<GmailDisclosure />");
      expect(src).not.toContain("Subwatch can&apos;t");
    }
  });

  it("the disclosure page needs a signed-in user: the proxy redirects signed-out visitors to /signin", () => {
    expect(gate({ path: "/connect-gmail", method: "GET", signedIn: false })).toBe("signin");
    expect(gate({ path: "/connect-gmail", method: "GET", signedIn: true })).toBe("next");
    expect(proxyConfig.matcher).toContain("/connect-gmail");
  });
});
