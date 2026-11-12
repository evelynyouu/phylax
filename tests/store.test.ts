import { describe, expect, it } from "vitest";
import { memoryStore } from "../lib/store/memory";
import { describeStore } from "./store-contract";

describeStore("memory", () => memoryStore());

describe("memory store", () => {
  it("keeps two memory stores apart", async () => {
    const a = memoryStore("u1");
    const b = memoryStore("u2");
    await a.saveRecord({
      emailId: "x", emailDate: "2026-09-01T00:00:00Z", kind: "receipt", relevant: true, merchant: null, merchantKey: null,
      amount: null, currency: null, cadence: null, dueDate: null, renewalDate: null, cancelUrl: null,
      cancelUrlTrusted: false, confidence: 1, method: "rules",
    });
    expect(await b.loadRecords()).toEqual([]);
  });
});
