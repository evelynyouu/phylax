import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanName } from "../lib/extract/merchant";
import { buildDashboard } from "../lib/resolve";
import { memoryStore } from "../lib/store/memory";
import type { Store } from "../lib/store/types";
import { toEditBody } from "../lib/subscription-edit";

const s = vi.hoisted(() => ({ store: null as unknown }));
vi.mock("@/lib/route-auth", () => ({ requireUser: async () => ({ user: { id: "u1", email: "u@x.co", name: "U" } }) }));
vi.mock("@/lib/store", () => ({ storeFor: async () => s.store }));

import { POST as editPOST } from "../app/api/subscriptions/edit/route";
import { POST as dismissPOST } from "../app/api/dismiss/route";

const req = (url: string, body: unknown) =>
  new Request(`http://127.0.0.1:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
    body: JSON.stringify(body),
  });
const edit = (b: unknown) => editPOST(req("/api/subscriptions/edit", b));
const gym = { merchant: "City Gym", amount: 40, cadence: "monthly", nextChargeDate: "2026-11-25", manual: true };

let store: Store;
beforeEach(() => {
  store = memoryStore("u1");
  s.store = store;
});

describe("a second edit keeps the first one", () => {
  it("merges fields into the stored edit instead of replacing it", async () => {
    await edit({ merchantKey: "netflix", amount: 17.99 });
    await edit({ merchantKey: "netflix", nextChargeDate: "2026-12-01" });
    expect((await store.listEdits())[0]).toMatchObject({ amount: 17.99, nextChargeDate: "2026-12-01", manual: false });
  });

  it("renaming a manual payment keeps its amount, cycle and date", async () => {
    await edit(gym);
    await edit({ merchantKey: "citygym", merchant: "Downtown Gym" });
    expect((await store.listEdits())[0]).toMatchObject({ merchant: "Downtown Gym", amount: 40, cadence: "monthly", nextChargeDate: "2026-11-25", manual: true });
  });

  it("the form sends every field when editing a manual payment", () => {
    const initial = { merchant: "City Gym", amount: "40", cadence: "monthly", nextChargeDate: "2026-11-25" };
    expect(toEditBody({ ...initial, merchant: "Downtown Gym" }, { mode: "edit", merchantKey: "citygym", initial, manual: true })).toEqual({
      merchantKey: "citygym", merchant: "Downtown Gym", amount: 40, cadence: "monthly", nextChargeDate: "2026-11-25", manual: true,
    });
  });
});

describe("adding a payment never silently does nothing", () => {
  it("needs an amount or a date", async () => {
    const res = await edit({ merchant: "City Gym", manual: true });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/amount or a next charge date/);
  });

  it("refuses a second payment whose name gives the same key", async () => {
    await edit(gym);
    const res = await edit({ ...gym, merchant: "City-Gym", amount: 55 });
    expect(res.status).toBe(400);
    expect((await store.listEdits())[0]).toMatchObject({ merchant: "City Gym", amount: 40 });
  });

  it("tracks a merchant again when you add it by hand after Stop tracking", async () => {
    await store.setMark("dismissed", "citygym", true);
    expect((await edit(gym)).status).toBe(200);
    expect((await store.marks("dismissed")).has("citygym")).toBe(false);
  });
});

describe("Stop tracking a manual payment", () => {
  it("removes the stored entry", async () => {
    await edit(gym);
    await dismissPOST(req("/api/dismiss", { merchantKey: "citygym" }));
    expect(await store.listEdits()).toEqual([]);
  });
});

describe("I've cancelled it on a manual payment", () => {
  it("moves it to cancelled", () => {
    const d = buildDashboard([], {
      today: "2026-11-11",
      manualCancels: new Map([["citygym", "2026-11-11T00:00:00Z"]]),
      edits: [{ merchantKey: "citygym", merchant: "City Gym", amount: 40, currency: "USD", cadence: "monthly", nextChargeDate: "2026-11-25", manual: true, updatedAt: "" }],
    });
    expect(d.subscriptions[0]).toMatchObject({ status: "cancelled", manualCancel: true });
    expect(d.totals.count).toBe(0);
  });
});

describe("merchant name cleanup stays fast", () => {
  it("handles a long run of separators in linear time", () => {
    const t = Date.now();
    expect(cleanName("a" + ",".repeat(5000) + "b")).toBe("a" + ",".repeat(5000) + "b");
    expect(cleanName("Acme" + " ,".repeat(5000))).toBe("Acme");
    expect(Date.now() - t).toBeLessThan(200);
  });
});
