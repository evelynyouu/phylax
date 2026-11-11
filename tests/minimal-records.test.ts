import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractedRecord, RawEmail } from "../lib/types";

// Records with relevant:false exist only so sync does not fetch the email again. Whatever the
// extractor returned (the AI path can fill fields for a non-billing email), sync saves only
// the id, date, kind, method and confidence for them.
const ex = vi.hoisted(() => ({ out: new Map<string, ExtractedRecord>() }));
vi.mock("../lib/extract", () => ({ extractEmail: async (e: { id: string }) => ex.out.get(e.id)! }));

import { memoryStore } from "../lib/store/memory";
import { getDashboard, runSync, type GmailLayer } from "../lib/sync";

const full = (over: Partial<ExtractedRecord>): ExtractedRecord => ({
  emailId: "x",
  emailDate: "2026-10-14T15:00:00Z",
  kind: "receipt",
  relevant: true,
  merchant: "Netflix",
  merchantKey: "netflix",
  amount: 15.49,
  currency: "USD",
  cadence: "monthly",
  dueDate: "2026-11-01",
  renewalDate: "2026-11-14",
  cancelUrl: "https://www.netflix.com/cancelplan",
  cancelUrlTrusted: true,
  confidence: 0.85,
  method: "llm",
  ...over,
});

const raw = (id: string): RawEmail => ({ id, from: "Netflix <info@netflix.com>", subject: "s", date: "2026-10-14T15:00:00Z", bodyText: "b", links: [] });

let prev: string | undefined;
beforeEach(() => {
  prev = process.env.DATA_SOURCE;
  delete process.env.DATA_SOURCE;
});
afterEach(() => {
  if (prev === undefined) delete process.env.DATA_SOURCE;
  else process.env.DATA_SOURCE = prev;
});

describe("saved records for non-billing emails", () => {
  it("carry no merchant, amount, dates or URL; billing records are kept whole", async () => {
    ex.out.set("promo", full({ emailId: "promo", kind: "marketing", relevant: false }));
    ex.out.set("bill", full({ emailId: "bill" }));
    const s = memoryStore("minimal");
    await s.setGmail({ gmailEmail: "me@gmail.com", encTokens: "enc", lastSyncEpoch: null, needsReconnect: false });
    const gmail: GmailLayer = { configured: () => true, listMessageIds: async () => ["promo", "bill"], fetchEmail: async (_s, id) => raw(id) };
    await runSync(s, undefined, gmail);

    const saved = new Map((await s.loadRecords()).map((r) => [r.emailId, r]));
    expect(saved.get("promo")).toEqual({
      emailId: "promo",
      emailDate: "2026-10-14T15:00:00Z",
      kind: "marketing",
      relevant: false,
      merchant: null,
      merchantKey: null,
      amount: null,
      currency: null,
      cadence: null,
      dueDate: null,
      renewalDate: null,
      cancelUrl: null,
      cancelUrlTrusted: false,
      confidence: 0.85,
      method: "llm",
    });
    expect(saved.get("bill")).toEqual(ex.out.get("bill"));
    // Still counted as seen, so the next sync skips it.
    expect(await s.knownIds(["promo"])).toEqual(new Set(["promo"]));
    // And resolve ignores it.
    const { dashboard } = await getDashboard(s);
    expect(dashboard.subscriptions.map((x) => x.merchantKey)).toEqual(["netflix"]);
  });
});
