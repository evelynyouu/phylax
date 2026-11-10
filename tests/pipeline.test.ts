import { describe, expect, it } from "vitest";
import { FIXTURE_EMAILS } from "../fixtures/emails";
import { runEval } from "../scripts/eval";
import { findDates, addMonths } from "../lib/extract/dates";
import { extractWithRules, pickAmount, pickCancelUrl } from "../lib/extract/rules";
import { extractAll } from "../lib/extract";
import { isTrustedLink, resolveMerchant } from "../lib/extract/merchant";
import { buildDashboard, rollForward } from "../lib/resolve";
import type { RawEmail } from "../lib/types";

const TODAY = "2026-11-09";

describe("dates", () => {
  it("parses common billing formats", () => {
    const text = "Due Nov 20, 2026. Also 2026-12-01 and 12/15/2026 and 3rd January 2027.";
    expect(findDates(text, "2026-11-01T00:00:00Z").map((d) => d.iso)).toEqual([
      "2026-11-20",
      "2026-12-01",
      "2026-12-15",
      "2027-01-03",
    ]);
  });

  it("infers a missing year from the email date, rolling into next year when needed", () => {
    expect(findDates("renews Jan 15", "2026-12-20T00:00:00Z")[0].iso).toBe("2027-01-15");
    expect(findDates("ends Nov 12", "2026-11-09T00:00:00Z")[0].iso).toBe("2026-11-12");
  });

  it("rejects impossible dates and clamps month math", () => {
    expect(findDates("Feb 30, 2026", "2026-01-01T00:00:00Z")).toEqual([]);
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("amounts", () => {
  it("prefers the labeled total over subtotals and discounts", () => {
    expect(pickAmount("Subtotal $10.00\nTax $0.80\nTotal: $10.80")).toEqual({ amount: 10.8, currency: "USD" });
    expect(pickAmount("Save $5 today! You will be charged $15.00")?.amount).toBe(15);
  });
  it("handles thousands separators", () => {
    expect(pickAmount("Amount due: $4,832.50")?.amount).toBe(4832.5);
  });
});

describe("merchants and link trust", () => {
  it("maps sender subdomains to the merchant", () => {
    expect(resolveMerchant("Netflix <info@mailer.netflix.com>", "x", "y").merchant).toBe("Netflix");
  });
  it("uses the real merchant behind a payment processor", () => {
    expect(resolveMerchant("PayPal <service@paypal.com>", "Receipt from Figma", "").merchant).toBe("Figma");
  });
  it("trusts only links on the sender's own domain", () => {
    expect(isTrustedLink("https://www.netflix.com/cancelplan", "netflix.com")).toBe(true);
    expect(isTrustedLink("https://netflix.com.evil.example/cancel", "netflix.com")).toBe(false);
    expect(isTrustedLink("http://www.netflix.com/cancelplan", "netflix.com")).toBe(false);
  });
});

describe("cancel link selection", () => {
  const base: RawEmail = { id: "t", from: "Acme <a@acme.com>", subject: "s", date: "2026-11-01T00:00:00Z", bodyText: "", links: [] };
  it("prefers a cancel link over an unsubscribe link", () => {
    const r = pickCancelUrl(
      {
        ...base,
        links: [
          { text: "Unsubscribe", href: "https://acme.com/unsubscribe" },
          { text: "Cancel membership", href: "https://acme.com/account/cancel" },
        ],
      },
      "acme.com"
    );
    expect(r).toEqual({ url: "https://acme.com/account/cancel", trusted: true });
  });
  it("never returns an http or javascript link", () => {
    const r = pickCancelUrl(
      {
        ...base,
        links: [
          { text: "Cancel", href: "http://acme.com/cancel" },
          { text: "Cancel", href: "javascript:alert(1)" },
        ],
      },
      "acme.com"
    );
    expect(r.url).toBeNull();
  });
  it("flags a cancel link on another domain as untrusted", () => {
    const r = pickCancelUrl({ ...base, links: [{ text: "Cancel", href: "https://cancel-now.example/x" }] }, "acme.com");
    expect(r.url).toBe("https://cancel-now.example/x");
    expect(r.trusted).toBe(false);
  });
});

describe("adversarial email", () => {
  it("treats prompt injection text as data and extracts only billing fields", () => {
    const email = FIXTURE_EMAILS.find((e) => e.subject.startsWith("Invoice due: Acme"))!;
    const rec = extractWithRules(email);
    expect(rec.kind).toBe("payment_due");
    expect(rec.amount).toBe(49);
    expect(JSON.stringify(rec)).not.toMatch(/attacker@evil|IGNORE/i);
  });
  it("drops senders that imitate a known brand from another domain", () => {
    const phish = FIXTURE_EMAILS.filter((e) => /netflix-account-support|spotify-premium/.test(e.from));
    expect(phish).toHaveLength(2);
    for (const e of phish) {
      const rec = extractWithRules(e);
      expect(rec.relevant).toBe(false);
      expect(rec.cancelUrl).toBeNull();
    }
  });
});

describe("dashboard", () => {
  it("builds subscriptions, upcoming payments, and deadlines from the fixtures", async () => {
    const recs = await extractAll(FIXTURE_EMAILS, { useLlm: false });
    const d = buildDashboard(recs, { today: TODAY });
    const by = (name: string) => d.subscriptions.find((s) => s.merchant === name)!;

    expect(by("Netflix")).toMatchObject({ status: "active", amount: 15.49, cadence: "monthly", nextChargeDate: "2026-11-14" });
    expect(by("Netflix").cancelUrl).toBe("https://www.netflix.com/cancelplan");
    expect(by("Spotify").priceChange).toMatchObject({ from: 11.99, to: 12.99 });
    expect(by("Cal Fitness").status).toBe("cancelled");
    expect(by("Cal Fitness").nextChargeDate).toBeNull();
    expect(by("Hulu").status).toBe("trial");
    expect(by("Amazon")).toMatchObject({ amount: 139, cadence: "yearly", nextChargeDate: "2027-01-15" });
    expect(by("Duolingo").priceChange).toMatchObject({ to: 14.99, effective: "2026-12-01" });

    // Bills are not subscriptions.
    expect(d.subscriptions.find((s) => s.merchant === "PG&E")).toBeUndefined();
    expect(d.upcoming.find((u) => u.merchant === "PG&E")).toMatchObject({ date: "2026-11-20", amount: 142.18, source: "bill" });

    // Deadlines include bills, trials, and auto-renewals, sorted by date.
    const dates = d.due.map((x) => x.date);
    expect([...dates].sort()).toEqual(dates);
    expect(d.due.some((x) => x.merchant === "Hulu" && x.kind === "trial_ending")).toBe(true);

    // Past due items older than the grace period are dropped.
    expect(d.due.some((x) => x.merchant === "T-Mobile" && x.date === "2026-10-25")).toBe(false);
  });

  it("hides dismissed merchants everywhere", async () => {
    const recs = await extractAll(FIXTURE_EMAILS, { useLlm: false });
    const d = buildDashboard(recs, { today: TODAY, dismissed: new Set(["netflix"]) });
    expect(d.subscriptions.some((s) => s.merchant === "Netflix")).toBe(false);
    expect(d.upcoming.some((u) => u.merchant === "Netflix")).toBe(false);
  });

  it("rolls stale dates forward by cadence", () => {
    expect(rollForward("2026-08-14", "monthly", TODAY)).toBe("2026-11-14");
    expect(rollForward("2026-11-20", "monthly", TODAY)).toBe("2026-11-20");
  });
});

describe("eval harness", () => {
  it("meets a regression floor on the labeled fixtures (rules only)", async () => {
    const r = await runEval(false);
    expect(r.relevance.precision).toBeGreaterThanOrEqual(0.95);
    expect(r.relevance.recall).toBeGreaterThanOrEqual(0.95);
    expect(r.amountAccuracy).toBeGreaterThanOrEqual(0.95);
    expect(r.dateAccuracy).toBeGreaterThanOrEqual(0.95);
  });
});
