import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The sidebar's Delete account and Disconnect buttons use the App Router; this renders them statically.
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
import Account from "../components/Account";
import AuthForm from "../components/AuthForm";
import Landing from "../app/page";
import SignInPage from "../app/signin/page";
import PrivacyPage from "../app/privacy/page";
import TermsPage from "../app/terms/page";
import { gate } from "../lib/gate";
import { publicLegalText, renderMarkdown } from "../lib/markdown";
import { config as proxyConfig } from "../proxy";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("privacy and terms pages", () => {
  it("render the privacy policy headings, its Last updated line and the contact placeholder as written", () => {
    const page = html(<PrivacyPage />);
    expect(page).toContain("<h1>Phylax Privacy Policy</h1>");
    for (const h of ["Google API disclosure (Limited Use)", "What Phylax collects and why", "How to control and delete your data", "Contact"]) {
      expect(page).toContain(`<h2>${h}</h2>`);
    }
    expect(page).toContain("Last updated:");
    expect(page).toContain("[CONTACT EMAIL]");
    expect(page).toContain("<table>");
    expect(page).toContain('href="https://developers.google.com/terms/api-services-user-data-policy"');
    expect(page).not.toContain("Draft for review");
  });

  it("render the terms headings without the draft line or the reviewer notes", () => {
    const page = html(<TermsPage />);
    expect(page).toContain("<h1>Phylax Terms of Use</h1>");
    for (const h of ["1. What Phylax is", "2. Phylax never cancels anything for you", "14. Contact"]) expect(page).toContain(`<h2>${h}</h2>`);
    expect(page).toContain("Effective date:");
    expect(page).toContain("[CONTACT EMAIL]");
    // The [APP URL]/privacy link points at this site's privacy page.
    expect(page).toContain('href="/privacy"');
    expect(page).not.toContain("Draft for review");
    expect(page).not.toContain("Notes for the reviewer");
  });

  it("escape text and render the markdown subset the legal files use", () => {
    const out = html(<>{renderMarkdown("# T\n\nA **b** `c` [d](https://e.example) <script>\n\n- one\n- two\n\n| x | y |\n|---|---|\n| 1 | 2 |")}</>);
    expect(out).toBe(
      '<h1>T</h1><p>A <strong>b</strong> <code>c</code> <a href="https://e.example">d</a> &lt;script&gt;</p><ul><li>one</li><li>two</li></ul><div style="overflow-x:auto"><table><thead><tr><th scope="col" style="text-align:left">x</th><th scope="col" style="text-align:left">y</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>',
    );
    expect(publicLegalText("Draft for review. Not legal advice.\n\n# A\n\nB\n\n---\n\n## Notes for the reviewer (delete before publishing)\n\n- x")).toBe("# A\n\nB");
  });
});

describe("markdown line breaks and links", () => {
  it("renders single line breaks inside a paragraph as <br />", () => {
    const out = html(<>{renderMarkdown("Effective date: X\nLast updated: Y\n\nNext")}</>);
    expect(out).toBe("<p>Effective date: X<br/>Last updated: Y</p><p>Next</p>");
  });

  it("links only https:, mailto:, and same-site paths; anything else is plain text", () => {
    const out = html(<>{renderMarkdown("[a](https://x.example) [b](mailto:a@b.co) [c](/privacy) [d](#top) [e](data:text/html,hi) [f](javascript:alert(1)) [g](http://x.example)")}</>);
    expect(out).toContain('href="https://x.example"');
    expect(out).toContain('href="mailto:a@b.co"');
    expect(out).toContain('href="/privacy"');
    expect(out).toContain('href="#top"');
    expect(out).not.toMatch(/href="(data|javascript|http):/);
    expect(out).toContain("[e](data:text/html,hi)");
    expect(out).not.toContain("<a href=\"javascript");
  });
});

describe("links to the privacy and terms pages", () => {
  it("sit under Sign out in the app sidebar", () => {
    const out = html(<Account user={{ id: "u", email: "u@x.co", name: "U", avatarPath: null, providers: [] }} syncNote="" />);
    expect(out.indexOf('href="/privacy"')).toBeGreaterThan(out.indexOf("Sign out"));
    expect(out).toContain('href="/terms"');
  });

  it("appear on sign-up with the agreement line, after both submit buttons", () => {
    const out = html(<AuthForm mode="signup" />);
    expect(out).toContain("By creating an account you agree to the");
    expect(out).toMatch(/agree to the <a[^>]*href="\/terms"[^>]*>Terms<\/a> and <a[^>]*href="\/privacy"[^>]*>Privacy Policy<\/a>\./);
    expect(out.indexOf("By creating an account")).toBeGreaterThan(out.lastIndexOf("Continue with Google"));
  });

  it("sign-in mode also shows the agreement line under the Google button", () => {
    const out = html(<AuthForm mode="signin" />);
    expect(out).toMatch(/By creating an account you agree to the <a[^>]*href="\/terms"[^>]*>Terms<\/a> and <a[^>]*href="\/privacy"[^>]*>Privacy Policy<\/a>\./);
    expect(out.indexOf("By creating an account")).toBeGreaterThan(out.indexOf("Continue with Google"));
  });

  it("appear on sign-in near the form footer", () => {
    const out = html(<SignInPage params={Promise.resolve({})} searchParams={Promise.resolve({})} />);
    const foot = out.slice(out.indexOf("Create an account"));
    expect(foot).toContain('href="/privacy"');
    expect(foot).toContain('href="/terms"');
  });

  it("replace the landing footer's #privacy anchor and add Terms", () => {
    const out = html(<Landing />);
    const footer = out.slice(out.indexOf("<footer"));
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/terms"');
    expect(footer).not.toContain('href="#privacy"');
  });
});

describe("privacy and terms stay public", () => {
  it("the gate lets signed-out visitors through", () => {
    for (const p of ["/privacy", "/terms"]) {
      expect(gate({ path: p, method: "GET", signedIn: false })).toBe("next");
      expect(gate({ path: p, method: "GET", signedIn: true })).toBe("next");
    }
  });

  it("the proxy does not even run on them", () => {
    const matchers = proxyConfig.matcher.map((m) => new RegExp(`^${m.replace("/:path*", "(/.*)?")}$`));
    for (const p of ["/privacy", "/terms"]) expect(matchers.some((r) => r.test(p))).toBe(false);
    // Sanity: the conversion does match what the proxy guards.
    expect(matchers.some((r) => r.test("/app/bills"))).toBe(true);
  });
});
