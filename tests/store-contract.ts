import { expect, it, describe } from "vitest";
import type { ExtractedRecord } from "../lib/types";
import type { Store } from "../lib/store/types";

export function rec(emailId: string, emailDate: string): ExtractedRecord {
  return {
    emailId,
    emailDate,
    kind: "receipt",
    relevant: true,
    merchant: "Netflix",
    merchantKey: "netflix",
    amount: 15.49,
    currency: "USD",
    cadence: "monthly",
    dueDate: null,
    renewalDate: null,
    cancelUrl: null,
    cancelUrlTrusted: false,
    confidence: 0.9,
    method: "rules",
  };
}

/** Shared contract for every Store implementation. */
export function describeStore(name: string, make: () => Store) {
  describe(`${name} store contract`, () => {
    it("saves, dedupes and orders records", async () => {
      const s = make();
      await s.saveRecord(rec("b", "2026-10-02T00:00:00Z"));
      await s.saveRecord(rec("a", "2026-09-01T00:00:00Z"));
      await s.saveRecord(rec("a", "2026-09-01T00:00:00Z"));
      expect((await s.loadRecords()).map((r) => r.emailId)).toEqual(["a", "b"]);
      expect(await s.hasRecord("a")).toBe(true);
      expect(await s.hasRecord("zzz")).toBe(false);
    });

    it("is last-write-wins on a duplicate emailId", async () => {
      const s = make();
      await s.saveRecord(rec("a", "2026-09-01T00:00:00Z"));
      await s.saveRecord({ ...rec("a", "2026-09-01T00:00:00Z"), amount: 20 });
      const all = await s.loadRecords();
      expect(all).toHaveLength(1);
      expect(all[0].amount).toBe(20);
    });

    it("sets, reads and clears marks per table", async () => {
      const s = make();
      await s.setMark("paid", "pge|2026-11-20", true);
      expect((await s.marks("paid")).has("pge|2026-11-20")).toBe(true);
      expect((await s.marks("reminders")).size).toBe(0);
      await s.setMark("paid", "pge|2026-11-20", false);
      expect((await s.marks("paid")).size).toBe(0);
    });

    it("stores and deletes the Gmail connection", async () => {
      const s = make();
      expect(await s.getGmail()).toBeNull();
      const c = { gmailEmail: "a@b.com", encTokens: "enc", lastSyncEpoch: 123, needsReconnect: false };
      await s.setGmail(c);
      expect(await s.getGmail()).toEqual(c);
      await s.setGmail({ ...c, needsReconnect: true });
      expect(await s.getGmail()).toEqual({ ...c, needsReconnect: true });
      await s.setGmail(null);
      expect(await s.getGmail()).toBeNull();
    });
  });
}
