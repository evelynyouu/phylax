import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { RawEmail } from "../lib/types";

const h = vi.hoisted(() => ({ logs: [] as unknown[][] }));
vi.mock("../lib/extract", () => ({
  extractEmail: async (e: { id: string }) => ({
    emailId: e.id, emailDate: "2026-10-14T15:00:00Z", kind: "marketing", relevant: false, merchant: null, merchantKey: null,
    amount: null, currency: null, cadence: null, dueDate: null, renewalDate: null, cancelUrl: null, cancelUrlTrusted: false,
    confidence: 0.5, method: "rules",
  }),
}));
vi.mock("../lib/log", async (orig) => ({
  ...(await orig<typeof import("../lib/log")>()),
  logError: (...a: unknown[]) => void h.logs.push(a),
}));

import { isTransientError } from "../lib/retry";
import { memoryStore } from "../lib/store/memory";
import { runSync, type GmailLayer } from "../lib/sync";

const raw = (id: string): RawEmail => ({ id, from: "a@b.c", subject: "SECRET SUBJECT", date: "2026-10-14T15:00:00Z", bodyText: "SECRET BODY", links: [] });
const httpErr = (status: number, reason?: string) =>
  Object.assign(new Error(`HTTP ${status}`), { code: status, status, errors: reason ? [{ reason }] : undefined });

describe("isTransientError", () => {
  it("retries 429 and 5xx", () => {
    for (const s of [429, 500, 502, 503, 504]) expect(isTransientError(httpErr(s))).toBe(true);
  });
  it("retries Gmail 403 rate limits in either shape", () => {
    expect(isTransientError(httpErr(403, "rateLimitExceeded"))).toBe(true);
    expect(isTransientError(Object.assign(new Error("x"), { code: 403, response: { data: { error: { errors: [{ reason: "userRateLimitExceeded" }] } } } }))).toBe(true);
    expect(isTransientError(httpErr(403, "insufficientPermissions"))).toBe(false);
    expect(isTransientError(httpErr(403))).toBe(false);
  });
  it("retries network codes", () => {
    for (const c of ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED"]) expect(isTransientError(Object.assign(new Error("n"), { code: c }))).toBe(true);
  });
  it("does not retry other 4xx, invalid_grant, or junk", () => {
    for (const s of [400, 401, 404]) expect(isTransientError(httpErr(s))).toBe(false);
    expect(isTransientError(Object.assign(new Error("invalid_grant"), { response: { data: { error: "invalid_grant" } } }))).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError("x")).toBe(false);
  });
});

describe("sync retries", () => {
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.DATA_SOURCE;
    process.env.DATA_SOURCE = "gmail";
    h.logs.length = 0;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.DATA_SOURCE;
    else process.env.DATA_SOURCE = prev;
  });

  async function run(fetchEmail: GmailLayer["fetchEmail"], ids = ["m1"]) {
    const s = memoryStore("retry");
    await s.setGmail({ gmailEmail: "me@gmail.com", encTokens: "enc", lastSyncEpoch: 1000, needsReconnect: false });
    const gmail: GmailLayer = { configured: () => true, listMessageIds: async () => ids, fetchEmail };
    const delays: number[] = [];
    const result = await runSync(s, undefined, gmail, { sleep: async (ms) => void delays.push(ms) });
    return { s, result, delays };
  }

  it("saves a message that fails twice with 429 then succeeds", async () => {
    let n = 0;
    const { s, result, delays } = await run(async (_s, id) => {
      if (++n <= 2) throw httpErr(429);
      return raw(id);
    });
    expect(result.errors).toBe(0);
    expect(result.processed).toBe(1);
    expect(n).toBe(3);
    expect(delays).toEqual([500, 1000]);
    expect((await s.getGmail())?.lastSyncEpoch).not.toBe(1000);
  });

  it("gives up after 4 attempts on persistent 503, keeps the cursor, logs once with no content", async () => {
    let n = 0;
    const { s, result } = await run(async () => {
      n++;
      throw httpErr(503);
    }, ["m1", "m2"]);
    expect(n).toBe(8);
    expect(result.errors).toBe(2);
    expect((await s.getGmail())?.lastSyncEpoch).toBe(1000);
    const flat = JSON.stringify(h.logs);
    expect(flat).not.toContain("SECRET");
    expect(flat).not.toContain("m1");
    expect(h.logs.filter((l) => JSON.stringify(l).includes("failed")).length).toBeGreaterThanOrEqual(2); // reason + summary
    expect(h.logs.some((l) => JSON.stringify(l).includes("sync finished with 2 failed messages"))).toBe(true);
    const reasonLogs = h.logs.filter((l) => !JSON.stringify(l).includes("sync finished"));
    expect(reasonLogs).toHaveLength(1);
  });

  it("does not retry a 404", async () => {
    let n = 0;
    const { result } = await run(async () => {
      n++;
      throw httpErr(404);
    });
    expect(n).toBe(1);
    expect(result.errors).toBe(1);
  });

  it("invalid_grant sets needsReconnect without retries", async () => {
    let n = 0;
    const s = memoryStore("retry2");
    await s.setGmail({ gmailEmail: "me@gmail.com", encTokens: "enc", lastSyncEpoch: null, needsReconnect: false });
    const gmail: GmailLayer = {
      configured: () => true,
      listMessageIds: async () => ["m1"],
      fetchEmail: async () => {
        n++;
        throw Object.assign(new Error("invalid_grant"), { response: { data: { error: "invalid_grant" } } });
      },
    };
    await expect(runSync(s, undefined, gmail, { sleep: async () => {} })).rejects.toThrow();
    expect(n).toBe(1);
    expect((await s.getGmail())?.needsReconnect).toBe(true);
  });

  it("logs distinct reasons once each", async () => {
    const { result } = await run(async (_s, id) => {
      throw id === "a" ? httpErr(503) : id === "b" ? httpErr(404) : id === "c" ? httpErr(503) : httpErr(404);
    }, ["a", "b", "c", "d"]);
    expect(result.errors).toBe(4);
    const reasons = h.logs.filter((l) => !JSON.stringify(l).includes("sync finished"));
    expect(reasons).toHaveLength(2);
  });
});
