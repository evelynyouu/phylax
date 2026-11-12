import { describe, expect, it, vi } from "vitest";
import { addThenCategorize } from "../lib/save-payment";

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
