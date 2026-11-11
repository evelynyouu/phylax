import { afterEach, describe, expect, it } from "vitest";
import { demoStore, memoryStore } from "../lib/store/memory";
import { isDemo } from "../lib/session";
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

  it("demoStore is a singleton with userId demo", () => {
    expect(demoStore()).toBe(demoStore());
    expect(demoStore().userId).toBe("demo");
  });
});

describe("isDemo", () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { ds: env.DATA_SOURCE, ne: env.NODE_ENV };
  afterEach(() => {
    if (saved.ds === undefined) delete env.DATA_SOURCE; else env.DATA_SOURCE = saved.ds;
    if (saved.ne === undefined) delete env.NODE_ENV; else env.NODE_ENV = saved.ne;
  });

  it("is true for fixtures outside production", () => {
    env.DATA_SOURCE = "fixtures";
    env.NODE_ENV = "development";
    expect(isDemo()).toBe(true);
  });
  it("is false in production even with fixtures", () => {
    env.DATA_SOURCE = "fixtures";
    env.NODE_ENV = "production";
    expect(isDemo()).toBe(false);
  });
  it("is false without fixtures", () => {
    delete env.DATA_SOURCE;
    env.NODE_ENV = "development";
    expect(isDemo()).toBe(false);
  });
});
