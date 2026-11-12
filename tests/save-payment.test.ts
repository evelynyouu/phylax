import { describe, expect, it, vi } from "vitest";
import { addThenCategorize, editThenCategorize } from "../lib/save-payment";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const body = { merchant: "City Gym", manual: true };

describe("addThenCategorize", () => {
  it("skips the category call for Pick for me", async () => {
    const post = vi.fn(async () => json({ ok: true, merchantKey: "citygym" }));
    expect(await addThenCategorize(post, body, "")).toEqual({ ok: true, merchantKey: "citygym" });
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("saves a picked category with the returned key", async () => {
    const post = vi.fn(async (url: string) => (url.includes("edit") ? json({ ok: true, merchantKey: "citygym" }) : json({ ok: true })));
    await addThenCategorize(post, body, "health");
    expect(post).toHaveBeenLastCalledWith("/api/categories", { merchantKey: "citygym", category: "health" });
  });
  it("reports a failed add as a payment failure and sends no category", async () => {
    const post = vi.fn(async () => json({ error: "You already added City Gym." }, 400));
    expect(await addThenCategorize(post, body, "health")).toEqual({ ok: false, stage: "payment", error: "You already added City Gym." });
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("after a failed category save, a retry never re-adds", async () => {
    let fail = true;
    const post = vi.fn(async (url: string) => (url.includes("edit") ? json({ ok: true, merchantKey: "citygym" }) : fail ? json({ error: "x" }, 500) : json({ ok: true })));
    const first = await addThenCategorize(post, body, "health");
    expect(first).toMatchObject({ ok: false, stage: "category", merchantKey: "citygym" });
    fail = false;
    const retry = await addThenCategorize(post, body, "health", "citygym");
    expect(retry).toEqual({ ok: true, merchantKey: "citygym" });
    expect(post.mock.calls.filter(([u]) => u === "/api/subscriptions/edit")).toHaveLength(1);
  });
});

describe("editThenCategorize", () => {
  const empty = { merchantKey: "netflix", merchant: null, amount: null, cadence: null, nextChargeDate: null, manual: false };
  it("a category-only change sends no edit request, only the category", async () => {
    const post = vi.fn(async () => json({ ok: true }));
    expect(await editThenCategorize(post, empty, "streaming", "other")).toEqual({ ok: true });
    expect(post.mock.calls).toEqual([["/api/categories", { merchantKey: "netflix", category: "streaming" }]]);
  });
  it("sends the edit, then the category only when it changed", async () => {
    const post = vi.fn(async () => json({ ok: true }));
    await editThenCategorize(post, { ...empty, amount: 7.99 }, "other", "other");
    expect(post.mock.calls).toEqual([["/api/subscriptions/edit", { ...empty, amount: 7.99 }]]);
  });
  it("always sends a manual payment's edit", async () => {
    const post = vi.fn(async () => json({ ok: true }));
    await editThenCategorize(post, { ...empty, manual: true }, "other", "other");
    expect(post).toHaveBeenCalledWith("/api/subscriptions/edit", { ...empty, manual: true });
  });
  it("sends nothing when nothing changed", async () => {
    const post = vi.fn(async () => json({ ok: true }));
    expect(await editThenCategorize(post, empty, "other", "other")).toEqual({ ok: true });
    expect(post).not.toHaveBeenCalled();
  });
  it("reports the server's error", async () => {
    const post = vi.fn(async () => json({ error: "Enter an amount" }, 400));
    expect(await editThenCategorize(post, { ...empty, amount: 1 }, "other", "other")).toEqual({ ok: false, error: "Enter an amount" });
  });
});
