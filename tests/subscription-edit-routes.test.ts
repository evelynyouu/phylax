import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStore } from "../lib/store/memory";
import type { Store } from "../lib/store/types";

const s = vi.hoisted(() => ({ denied: null as null | number, stores: new Map<string, unknown>() }));

vi.mock("@/lib/route-auth", () => ({
  requireUser: async () =>
    s.denied ? { denied: NextResponse.json({ error: "no" }, { status: s.denied }) } : { user: { id: "u1", email: "u@x.co", name: "U" } },
}));
vi.mock("@/lib/store", () => ({ storeFor: async (u: { id: string }) => s.stores.get(u.id) }));

import { POST as editPOST } from "../app/api/subscriptions/edit/route";
import { POST as deletePOST } from "../app/api/subscriptions/edit/delete/route";

const req = (body: unknown) =>
  new Request("http://127.0.0.1:3000/api/subscriptions/edit", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
    body: JSON.stringify(body),
  });

let u1: Store;
let u2: Store;
beforeEach(() => {
  s.denied = null;
  u1 = memoryStore("u1");
  u2 = memoryStore("u2");
  s.stores = new Map([["u1", u1], ["u2", u2]]);
});

describe("POST /api/subscriptions/edit", () => {
  it("refuses signed-out and foreign-origin requests", async () => {
    s.denied = 401;
    expect((await editPOST(req({ merchantKey: "netflix", amount: 5 }))).status).toBe(401);
    s.denied = 403;
    expect((await editPOST(req({ merchantKey: "netflix", amount: 5 }))).status).toBe(403);
    expect(await u1.listEdits()).toEqual([]);
  });

  it("saves a partial edit for the signed-in user only", async () => {
    const res = await editPOST(req({ merchantKey: "netflix", amount: 17.99 }));
    expect(res.status).toBe(200);
    expect(await u1.listEdits()).toEqual([expect.objectContaining({ merchantKey: "netflix", amount: 17.99, merchant: null, cadence: null, manual: false })]);
    expect(await u2.listEdits()).toEqual([]);
  });

  it("ignores an edit that changes no field, so a category-only change does not mark the row Edited", async () => {
    const res = await editPOST(req({ merchantKey: "netflix", merchant: null, amount: null, cadence: null, nextChargeDate: null, manual: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, merchantKey: "netflix" });
    expect(await u1.listEdits()).toEqual([]);
  });

  it("adds a manual payment and derives its key from the name", async () => {
    const res = await editPOST(req({ merchant: "City Gym", amount: 40, cadence: "monthly", nextChargeDate: "2026-11-25", manual: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, merchantKey: "citygym" });
    expect((await u1.listEdits())[0]).toMatchObject({ merchantKey: "citygym", merchant: "City Gym", currency: "USD", manual: true });
  });

  it.each([
    [{ merchantKey: "netflix", amount: -1 }, "amount"],
    [{ merchantKey: "netflix", amount: 100001 }, "amount"],
    [{ merchantKey: "netflix", amount: 1.234 }, "amount"],
    [{ merchantKey: "netflix", nextChargeDate: "2026-02-30" }, "date"],
    [{ merchantKey: "netflix", nextChargeDate: "11/25/2026" }, "date"],
    [{ merchantKey: "netflix", cadence: "daily" }, "cycle"],
    [{ merchantKey: "netflix", merchant: "x".repeat(81) }, "name"],
    [{ merchantKey: "netflix", currency: "JPY" }, "currency"],
    [{ manual: true, amount: 5 }, "name"],
    [{ merchantKey: "Bad Key!", amount: 5 }, "bad request"],
  ])("rejects invalid input %j", async (body, word) => {
    const res = await editPOST(req(body));
    expect(res.status).toBe(400);
    expect(String((await res.json()).error).toLowerCase()).toContain(word);
    expect(await u1.listEdits()).toEqual([]);
  });
});

describe("POST /api/subscriptions/edit/delete", () => {
  it("removes the signed-in user's edit", async () => {
    await u1.saveEdit({ merchantKey: "netflix", merchant: null, amount: 9, currency: null, cadence: null, nextChargeDate: null, manual: false });
    await u2.saveEdit({ merchantKey: "netflix", merchant: null, amount: 9, currency: null, cadence: null, nextChargeDate: null, manual: false });
    const res = await deletePOST(req({ merchantKey: "netflix" }));
    expect(res.status).toBe(200);
    expect(await u1.listEdits()).toEqual([]);
    expect(await u2.listEdits()).toHaveLength(1);
  });
  it("refuses signed-out requests and bad keys", async () => {
    s.denied = 401;
    expect((await deletePOST(req({ merchantKey: "netflix" }))).status).toBe(401);
    s.denied = null;
    expect((await deletePOST(req({ merchantKey: "../x" }))).status).toBe(400);
  });
});
