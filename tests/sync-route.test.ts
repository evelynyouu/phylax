import { describe, expect, it, vi } from "vitest";

const sync = vi.hoisted(() => ({ error: null as unknown }));

vi.mock("@/lib/route-auth", () => ({ requireUser: async () => ({ user: { id: "u1", email: "u@x.co" } }) }));
vi.mock("@/lib/current-user", () => ({ getOptionalUser: async () => null }));
vi.mock("@/lib/store", () => ({ storeFor: async () => ({ userId: "u1" }) }));
vi.mock("@/lib/sync", async () => {
  const real = await vi.importActual<typeof import("../lib/sync")>("../lib/sync");
  return {
    ...real,
    runSync: async () => {
      throw sync.error;
    },
  };
});

import { POST } from "../app/api/sync/route";
import { GmailReconnectError, SyncAlreadyRunningError } from "../lib/sync";

const post = () => POST(new Request("http://localhost/api/sync", { method: "POST" }));

describe("POST /api/sync errors", () => {
  it("never sends the raw error text to the browser, and logs it on the server", async () => {
    sync.error = new Error("relation records does not exist at db.internal:5432");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Sync failed. Please try again." });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("keeps the reconnect and already-running answers", async () => {
    sync.error = new GmailReconnectError();
    let res = await post();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "reconnect" });
    sync.error = new SyncAlreadyRunningError();
    res = await post();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "A sync is already running" });
  });
});
