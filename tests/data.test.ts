import { describe, expect, it } from "vitest";
import { billKey, chargesForMonth } from "../lib/calendar";
import { categoryFor } from "../lib/categories";
import { GMAIL_SCOPE, SCOPES, updateGmail } from "../lib/gmail";
import { buildDashboard } from "../lib/resolve";
import { memoryStore } from "../lib/store/memory";
import { getDashboard, GmailReconnectError, runSync, syncProgress, type GmailLayer } from "../lib/sync";
import type { Store } from "../lib/store/types";
import type { ExtractedRecord, Subscription } from "../lib/types";
import { gmailState } from "../lib/views";

const TODAY = "2026-11-09";

function rec(over: Partial<ExtractedRecord> & { emailDate: string }): ExtractedRecord {
  return {
    emailId: `${over.merchantKey ?? "m"}-${over.emailDate}-${over.kind ?? "receipt"}`,
    kind: "receipt",
    relevant: true,
    merchant: "Netflix",
    merchantKey: "netflix",
    amount: 15.49,
    currency: "USD",
    cadence: "monthly",
    dueDate: null,
    renewalDate: null,
    cancelUrl: "https://www.netflix.com/cancelplan",
    cancelUrlTrusted: true,
    confidence: 0.9,
    method: "rules",
    ...over,
  };
}

const netflix = [
  rec({ emailDate: "2026-08-14T15:00:00Z" }),
  rec({ emailDate: "2026-09-14T15:00:00Z" }),
  rec({ emailDate: "2026-10-14T15:00:00Z" }),
];
const netflixRenewal = rec({ emailDate: "2026-11-07T15:00:00Z", kind: "renewal_notice", renewalDate: "2026-11-14" });
const pgeBill = rec({
  emailDate: "2026-11-01T15:00:00Z",
  kind: "payment_due",
  merchant: "PG&E",
  merchantKey: "pge",
  amount: 142.18,
  cadence: null,
  dueDate: "2026-11-20",
  cancelUrl: null,
});

describe("categories", () => {
  it("maps known merchants and falls back to Other", () => {
    expect(categoryFor("netflix")).toBe("streaming");
    expect(categoryFor("openai")).toBe("software");
    expect(categoryFor("dropbox")).toBe("storage");
    expect(categoryFor("amazon")).toBe("shopping");
    expect(categoryFor("chegg")).toBe("learning");
    expect(categoryFor("acmecloud")).toBe("other");
  });
});

describe("manual cancellation", () => {
  it("hides future charges and renewal deadlines after 'I've cancelled it'", () => {
    const d = buildDashboard([...netflix, netflixRenewal, pgeBill], {
      today: TODAY,
      manualCancels: new Map([["netflix", "2026-11-08T10:00:00Z"]]),
    });
    const s = d.subscriptions.find((x) => x.merchantKey === "netflix")!;
    expect(s).toMatchObject({ status: "cancelled", manualCancel: true, nextChargeDate: null });
    expect(d.upcoming.some((u) => u.merchantKey === "netflix")).toBe(false);
    expect(d.due.some((x) => x.merchantKey === "netflix")).toBe(false);
  });

  it("comes back to active when a newer receipt arrives", () => {
    const newer = rec({ emailDate: "2026-11-14T15:00:00Z" });
    const d = buildDashboard([...netflix, newer], {
      today: "2026-11-15",
      manualCancels: new Map([["netflix", "2026-11-08T10:00:00Z"]]),
    });
    expect(d.subscriptions.find((x) => x.merchantKey === "netflix")).toMatchObject({ status: "active", manualCancel: false });
  });

  it("never hides a bill from the same merchant", () => {
    const bill = { ...pgeBill, merchant: "Netflix", merchantKey: "netflix", dueDate: "2026-11-25" };
    const d = buildDashboard([...netflix, bill], { today: TODAY, manualCancels: new Map([["netflix", "2026-11-08T10:00:00Z"]]) });
    expect(d.due.some((x) => x.kind === "payment_due" && x.merchantKey === "netflix")).toBe(true);
    expect(d.bills.some((b) => b.merchantKey === "netflix")).toBe(true);
  });
});

describe("paid bills and reminders", () => {
  it("marks a paid bill and drops it from upcoming charges", () => {
    const key = billKey("pge", "2026-11-20");
    const d = buildDashboard([pgeBill], { today: TODAY, paid: new Set([key]), reminders: new Set([key]) });
    expect(d.upcoming.some((u) => u.merchantKey === "pge")).toBe(false);
    expect(d.due.find((x) => x.key === key)).toMatchObject({ paid: true, reminder: true });
    expect(d.bills.find((b) => b.key === key)).toMatchObject({ paid: true, reminder: true, dueDate: "2026-11-20" });
  });
});

describe("calendar", () => {
  const sub = (over: Partial<Subscription>): Subscription => ({
    merchantKey: "x",
    merchant: "X",
    status: "active",
    amount: 10,
    currency: "USD",
    cadence: "monthly",
    lastChargeDate: null,
    nextChargeDate: "2026-11-14",
    priceChange: null,
    cancelUrl: null,
    cancelUrlTrusted: false,
    evidenceEmailIds: [],
    annualCost: 120,
    manualCancel: false,
    edited: false,
    manual: false,
    category: "other",
    categoryChosen: false,
    ...over,
  });
  const empty = { subscriptions: [], bills: [], receipts: [] };

  it("projects monthly charges into any future month", () => {
    const e = chargesForMonth({ ...empty, subscriptions: [sub({})] }, 2027, 3, TODAY);
    expect(e.map((x) => x.date)).toEqual(["2027-03-14"]);
    expect(e[0]).toMatchObject({ kind: "subscription", amount: 10, merchantKey: "x" });
  });

  it("does not drift when the anchor is the 31st", () => {
    const s = sub({ nextChargeDate: "2027-01-31" });
    expect(chargesForMonth({ ...empty, subscriptions: [s] }, 2027, 2, TODAY).map((x) => x.date)).toEqual(["2027-02-28"]);
    expect(chargesForMonth({ ...empty, subscriptions: [s] }, 2027, 3, TODAY).map((x) => x.date)).toEqual(["2027-03-31"]);
  });

  it("handles weekly, quarterly and yearly cadences", () => {
    const weekly = sub({ cadence: "weekly", nextChargeDate: "2026-12-02" });
    expect(chargesForMonth({ ...empty, subscriptions: [weekly] }, 2026, 12, TODAY)).toHaveLength(5);
    const yearly = sub({ cadence: "yearly", nextChargeDate: "2026-12-01" });
    expect(chargesForMonth({ ...empty, subscriptions: [yearly] }, 2027, 12, TODAY).map((x) => x.date)).toEqual(["2027-12-01"]);
    expect(chargesForMonth({ ...empty, subscriptions: [yearly] }, 2027, 6, TODAY)).toEqual([]);
    const q = sub({ cadence: "quarterly", nextChargeDate: "2026-11-30" });
    expect(chargesForMonth({ ...empty, subscriptions: [q] }, 2027, 2, TODAY).map((x) => x.date)).toEqual(["2027-02-28"]);
  });

  it("projects only from today on; past days show real receipts instead", () => {
    const s = sub({ nextChargeDate: "2026-11-14" });
    const receipts = [{ merchantKey: "x", merchant: "X", amount: 10, currency: "USD", date: "2026-10-14" }];
    const oct = chargesForMonth({ ...empty, subscriptions: [s], receipts }, 2026, 10, TODAY);
    expect(oct).toEqual([expect.objectContaining({ date: "2026-10-14", kind: "charged" })]);
    const nov = chargesForMonth({ ...empty, subscriptions: [s] }, 2026, 11, TODAY);
    expect(nov.map((x) => x.date)).toEqual(["2026-11-14"]);
  });

  it("skips cancelled subscriptions and includes bills by due date", () => {
    const bills = [{ key: "pge|2026-11-20", merchantKey: "pge", merchant: "PG&E", amount: 142.18, currency: "USD", dueDate: "2026-11-20", paid: false, reminder: false, category: "other" as const }];
    const e = chargesForMonth({ ...empty, subscriptions: [sub({ status: "cancelled", nextChargeDate: null })], bills }, 2026, 11, TODAY);
    expect(e).toEqual([expect.objectContaining({ date: "2026-11-20", kind: "bill", merchant: "PG&E" })]);
  });
});

describe("store: paid, reminders, manual cancels", () => {
  it("stores and clears each kind of user mark", async () => {
    const s = memoryStore("marks");
    await s.setMark("paid", "pge|2026-11-20", true);
    await s.setMark("reminders", "pge|2026-11-20", true);
    await s.setMark("manual_cancels", "netflix", true);
    expect((await s.marks("paid")).has("pge|2026-11-20")).toBe(true);
    expect((await s.marks("reminders")).has("pge|2026-11-20")).toBe(true);
    expect((await s.marks("manual_cancels")).get("netflix")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await s.setMark("paid", "pge|2026-11-20", false);
    await s.setMark("reminders", "pge|2026-11-20", false);
    await s.setMark("manual_cancels", "netflix", false);
    expect((await s.marks("paid")).size + (await s.marks("reminders")).size + (await s.marks("manual_cancels")).size).toBe(0);
  });
});

// The pipeline tests read the sample emails in fixtures/ through runSync's test-only source option.
const FIXTURES = { source: "fixtures" as const };

describe("sync progress", { timeout: 15000 }, () => {
  it("reports progress while a sync runs and a summary when it ends", async () => {
    const s = memoryStore("progress");
    const seen: number[] = [];
    const r = await runSync(s, (p) => seen.push(p.processed), undefined, FIXTURES);
    expect(r.processed).toBe(45);
    expect(seen.length).toBeGreaterThan(1);
    expect(seen[seen.length - 1]).toBe(45);
    expect(syncProgress("progress")).toMatchObject({ running: false, listed: 45, processed: 45, checked: 45 });
    // A second scan finds nothing new but still reports every email it looked at.
    await runSync(s, undefined, undefined, FIXTURES);
    expect(syncProgress("progress")).toMatchObject({ listed: 45, processed: 0, checked: 45 });
  });

  it("sync progress is per user", async () => {
    const a = memoryStore("a"), b = memoryStore("b");
    await runSync(a, undefined, undefined, FIXTURES);
    expect(syncProgress("a")).toMatchObject({ processed: 45, checked: 45 });
    expect(syncProgress("b")).toMatchObject({ listed: 0, processed: 0 });
    expect(await b.loadRecords()).toEqual([]);
  });

  it("a second sync for the same user while one runs is refused", async () => {
    const s = memoryStore("c");
    const first = runSync(s, undefined, undefined, FIXTURES);
    await expect(runSync(s, undefined, undefined, FIXTURES)).rejects.toThrow(/already running/);
    await first;
  });

  it("dashboard reads paid, reminders, dismissed and manual cancels from the store", async () => {
    const s = memoryStore("d");
    await runSync(s, undefined, undefined, FIXTURES);
    await s.setMark("manual_cancels", "netflix", true);
    const { dashboard } = await getDashboard(s);
    expect(dashboard.subscriptions.find((x) => x.merchantKey === "netflix")!.status).toBe("cancelled");
  });
});

describe("expired Gmail token (invalid_grant)", { timeout: 15000 }, () => {
  const grant = () => Object.assign(new Error("invalid_grant"), { response: { data: { error: "invalid_grant", error_description: "Token has been expired or revoked." } } });
  const raw = (id: string) => ({ id, from: "Netflix <info@netflix.com>", subject: "Your receipt", date: "2026-10-14T15:00:00Z", bodyText: "Total $15.49", links: [] });

  async function connected(userId: string) {
    const s = memoryStore(userId);
    await s.saveRecord(netflix[0]);
    await s.setGmail({ gmailEmail: "me@gmail.com", encTokens: "enc", lastSyncEpoch: 1000, needsReconnect: false });
    return s;
  }

  it("when fetching mail: stops, deletes nothing, does not count errors, and marks the connection", async () => {
    const s = await connected("grant-fetch");
    let fetched = 0;
    const gmail: GmailLayer = {
      configured: () => true,
      listMessageIds: async () => ["m1", "m2", "m3", "m4", "m5", "m6", "m7"],
      fetchEmail: async (_s, id) => {
        fetched++;
        if (id === "m1") return raw(id);
        throw grant();
      },
    };
    await expect(runSync(s, undefined, gmail)).rejects.toBeInstanceOf(GmailReconnectError);
    // No further batches after the token is known to be dead.
    expect(fetched).toBeLessThanOrEqual(5);
    expect((await s.loadRecords()).map((r) => r.emailId)).toContain(netflix[0].emailId);
    expect(await s.getGmail()).toMatchObject({ gmailEmail: "me@gmail.com", lastSyncEpoch: 1000, needsReconnect: true });
    expect(syncProgress("grant-fetch")).toMatchObject({ running: false, error: "reconnect" });

    const after = await getDashboard(s);
    expect(after).toMatchObject({ connected: true, reconnect: true });
    expect(after.dashboard.subscriptions.some((x) => x.merchantKey === "netflix")).toBe(true);
  });

  it("when listing mail: same outcome", async () => {
    const s = await connected("grant-list");
    const gmail: GmailLayer = {
      configured: () => true,
      listMessageIds: async () => {
        throw grant();
      },
      fetchEmail: async () => null,
    };
    await expect(runSync(s, undefined, gmail)).rejects.toThrow(GmailReconnectError);
    expect(await s.loadRecords()).toHaveLength(1);
    expect(await s.getGmail()).toMatchObject({ needsReconnect: true, lastSyncEpoch: 1000 });
  });

  it("other per-message failures still count as errors and leave the connection alone", async () => {
    const s = await connected("other-error");
    const gmail: GmailLayer = {
      configured: () => true,
      listMessageIds: async () => ["m1", "m2"],
      fetchEmail: async (_s, id) => {
        if (id === "m2") throw new Error("rate limited");
        return raw(id);
      },
    };
    const r = await runSync(s, undefined, gmail);
    expect(r).toMatchObject({ processed: 1, errors: 1 });
    expect(await s.getGmail()).toMatchObject({ needsReconnect: false, lastSyncEpoch: 1000 });
  });

  it("a clean sync advances the cursor and clears a reconnect flag", async () => {
    const s = await connected("clean");
    await s.setGmail({ gmailEmail: "me@gmail.com", encTokens: "enc", lastSyncEpoch: 1000, needsReconnect: true });
    const gmail: GmailLayer = { configured: () => true, listMessageIds: async () => ["m1"], fetchEmail: async (_s, id) => raw(id) };
    await runSync(s, undefined, gmail);
    const c = await s.getGmail();
    expect(c!.needsReconnect).toBe(false);
    expect(c!.lastSyncEpoch).toBeGreaterThan(1000);
  });

  it("checks which listed ids are already stored in one batched call, not one per id", async () => {
    const base = await connected("batched");
    for (let i = 0; i < 300; i++) await base.saveRecord(rec({ emailDate: "2026-09-01T00:00:00Z", emailId: `m${i}` }));
    const calls: number[] = [];
    const s: Store = {
      ...base,
      knownIds: async (ids) => {
        calls.push(ids.length);
        return base.knownIds(ids);
      },
    };
    let fetched = 0;
    const gmail: GmailLayer = {
      configured: () => true,
      listMessageIds: async () => Array.from({ length: 450 }, (_, i) => `m${i}`),
      fetchEmail: async (_s, id) => {
        fetched++;
        return raw(id);
      },
    };
    const r = await runSync(s, undefined, gmail);
    expect(calls).toEqual([450]);
    expect(fetched).toBe(150);
    expect(r).toMatchObject({ listed: 450, processed: 150 });
  });

  it("a sync for mailbox A never writes its cursor onto mailbox B connected meanwhile", async () => {
    const s = await connected("switched");
    const b = { gmailEmail: "other@gmail.com", encTokens: "enc-b", lastSyncEpoch: null, needsReconnect: false };
    const gmail: GmailLayer = {
      configured: () => true,
      listMessageIds: async () => ["m1"],
      fetchEmail: async (_s, id) => {
        // The user connects a different Gmail while this sync is reading mail.
        await s.setGmail(b);
        return raw(id);
      },
    };
    await runSync(s, undefined, gmail);
    expect(await s.getGmail()).toEqual(b);
  });

  it("a reconnect flag for mailbox A is not set on mailbox B", async () => {
    const s = await connected("switched-grant");
    const b = { gmailEmail: "other@gmail.com", encTokens: "enc-b", lastSyncEpoch: null, needsReconnect: false };
    const gmail: GmailLayer = {
      configured: () => true,
      listMessageIds: async () => ["m1"],
      fetchEmail: async () => {
        await s.setGmail(b);
        throw grant();
      },
    };
    await expect(runSync(s, undefined, gmail)).rejects.toBeInstanceOf(GmailReconnectError);
    expect(await s.getGmail()).toEqual(b);
  });

  it("refuses without a connection", async () => {
    const s = memoryStore("none");
    const gmail: GmailLayer = { configured: () => true, listMessageIds: async () => [], fetchEmail: async () => null };
    await expect(runSync(s, undefined, gmail)).rejects.toThrow(/not connected/);
    // Progress is polled by the browser, so it carries a fixed line, never the raw error text.
    expect(syncProgress("none").error).toBe("Sync failed. Please try again.");
    expect(await getDashboard(s)).toMatchObject({ connected: false, reconnect: false });
  });
});

describe("Gmail connection writes", () => {
  it("a token write for mailbox A is skipped once the row belongs to mailbox B", async () => {
    const s = memoryStore("swap");
    await s.setGmail({ gmailEmail: "a@gmail.com", encTokens: "enc-a", lastSyncEpoch: 10, needsReconnect: false });
    const b = { gmailEmail: "b@gmail.com", encTokens: "enc-b", lastSyncEpoch: null, needsReconnect: false };
    await s.setGmail(b);
    await updateGmail(s, "a@gmail.com", (c) => ({ ...c, encTokens: "enc-a-refreshed" }));
    expect(await s.getGmail()).toEqual(b);
  });

  it("still writes when the row is the same mailbox (address case does not matter)", async () => {
    const s = memoryStore("same");
    await s.setGmail({ gmailEmail: "A@gmail.com", encTokens: "enc-a", lastSyncEpoch: 10, needsReconnect: false });
    await updateGmail(s, "a@gmail.com", (c) => ({ ...c, encTokens: "enc-a2" }));
    expect((await s.getGmail())!.encTokens).toBe("enc-a2");
  });
});

describe("Gmail state of an /app page", () => {
  it("shows the connect empty state only when not connected and nothing was found", () => {
    expect(gmailState({ connected: false, reconnect: false, hasData: false })).toBe("connect");
    expect(gmailState({ connected: false, reconnect: false, hasData: true })).toBe("disconnected");
    expect(gmailState({ connected: true, reconnect: true, hasData: true })).toBe("reconnect");
    expect(gmailState({ connected: true, reconnect: true, hasData: false })).toBe("reconnect");
    expect(gmailState({ connected: true, reconnect: false, hasData: false })).toBe("ok");
  });
});

describe("Gmail scopes and data source", () => {
  it("the app reads Gmail unless a test passes the fixtures source, whatever DATA_SOURCE says", async () => {
    process.env.DATA_SOURCE = "fixtures";
    try {
      const gmail = { configured: () => false } as unknown as GmailLayer;
      await expect(runSync(memoryStore("no-demo"), undefined, gmail)).rejects.toThrow(/GOOGLE_CLIENT_ID/);
    } finally {
      delete process.env.DATA_SOURCE;
    }
  });

  it("asks Google for read-only Gmail plus the account email, nothing else", () => {
    expect(SCOPES).toEqual([GMAIL_SCOPE, "openid", "email"]);
    expect(GMAIL_SCOPE).toBe("https://www.googleapis.com/auth/gmail.readonly");
  });
});

describe("resolve: one-off purchases", () => {
  it("a one-off purchase after 'I've cancelled it' does not bring the subscription back", () => {
    const order = rec({ emailDate: "2026-11-09T15:00:00Z", amount: 34.18, cadence: null });
    const d = buildDashboard([...netflix, order], { today: "2026-11-10", manualCancels: new Map([["netflix", "2026-11-08T10:00:00Z"]]) });
    expect(d.subscriptions.find((s) => s.merchantKey === "netflix")!.status).toBe("cancelled");
  });

  it("leaves one-off purchases off the calendar's past charges", () => {
    const order = rec({ emailDate: "2026-10-28T15:00:00Z", amount: 34.18, cadence: null });
    expect(buildDashboard([...netflix, order], { today: TODAY }).receipts.some((r) => r.amount === 34.18)).toBe(false);
  });
});
