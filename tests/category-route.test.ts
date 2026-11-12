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

import { POST } from "../app/api/categories/route";
import { POST as editPOST } from "../app/api/subscriptions/edit/route";

const req = (body: unknown) =>
  new Request("http://127.0.0.1:3000/api/categories", {
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

describe("POST /api/categories", () => {
  it("passes 401 and 403 through without saving", async () => {
    s.denied = 401;
    expect((await POST(req({ merchantKey: "pge", category: "utilities" }))).status).toBe(401);
    s.denied = 403;
    expect((await POST(req({ merchantKey: "pge", category: "utilities" }))).status).toBe(403);
    expect((await u1.listCategories()).size).toBe(0);
  });

  it("saves for the signed-in user only", async () => {
    const res = await POST(req({ merchantKey: "pge", category: "utilities" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect([...(await u1.listCategories())]).toEqual([["pge", "utilities"]]);
    expect((await u2.listCategories()).size).toBe(0);
  });

  it("clears the choice with null", async () => {
    await POST(req({ merchantKey: "pge", category: "utilities" }));
    expect((await POST(req({ merchantKey: "pge", category: null }))).status).toBe(200);
    expect((await u1.listCategories()).size).toBe(0);
  });

  it("saves a key that has no record yet", async () => {
    expect((await POST(req({ merchantKey: "citygym", category: "health" }))).status).toBe(200);
    expect([...(await u1.listCategories()).keys()]).toEqual(["citygym"]);
  });

  it.each([
    [{ merchantKey: "Bad Key!", category: "other" }],
    [{ merchantKey: "pge", category: "crypto" }],
    [{ merchantKey: "pge" }],
    [{ category: "other" }],
    [null],
  ])("rejects %j", async (body) => {
    expect((await POST(req(body))).status).toBe(400);
    expect((await u1.listCategories()).size).toBe(0);
  });

  it("gives a hand-added payment a category using the returned key", async () => {
    const add = await editPOST(req({ merchant: "City Gym", amount: 40, cadence: "monthly", nextChargeDate: "2026-11-25", manual: true }));
    const { merchantKey } = await add.json();
    expect(merchantKey).toBe("citygym");
    expect((await POST(req({ merchantKey, category: "health" }))).status).toBe(200);
    expect([...(await u1.listCategories())]).toEqual([["citygym", "health"]]);
  });
});
