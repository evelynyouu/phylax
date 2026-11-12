import { beforeEach, describe, expect, it, vi } from "vitest";

// Route-level tests for account deletion and Disconnect, with Supabase and Google faked.
const s = vi.hoisted(() => ({
  adminThrows: null as Error | null,
  deleteError: null as { message: string } | null,
  deleted: [] as string[],
  signOuts: 0,
  disconnects: 0,
  revokeFailed: false,
  gmail: { gmailEmail: "g@x.co" } as { gmailEmail: string } | null,
  revokes: [] as { email: string; deletedAtCall: number }[],
  removed: [] as string[][],
  removeThrows: false,
  removeError: null as null | { message: string },
}));

vi.mock("@/lib/route-auth", () => ({ requireUser: async () => ({ user: { id: "u1", email: "u@x.co", name: "U" } }) }));
vi.mock("@/lib/store", () => ({ storeFor: async () => ({ userId: "u1", getGmail: async () => s.gmail }) }));
vi.mock("@/lib/gmail", () => ({
  revokeBestEffort: async (c: { gmailEmail: string } | null) => {
    if (c) s.revokes.push({ email: c.gmailEmail, deletedAtCall: s.deleted.length });
    return !s.revokeFailed;
  },
  disconnect: async () => {
    s.disconnects++;
    return { revokeFailed: s.revokeFailed };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      signOut: async () => {
        s.signOuts++;
        return {};
      },
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => {
    if (s.adminThrows) throw s.adminThrows;
    return {
      storage: {
        from: (bucket: string) => ({
          remove: async (paths: string[]) => {
            if (s.removeThrows) throw new Error("storage down");
            s.removed.push([bucket, ...paths]);
            return { error: s.removeError };
          },
        }),
      },
      auth: {
        admin: {
          deleteUser: async (id: string) => {
            if (s.deleteError) return { error: s.deleteError };
            s.deleted.push(id);
            return { error: null };
          },
        },
      },
    };
  },
}));

import { POST as deleteAccount } from "../app/api/account/delete/route";
import { POST as disconnectRoute } from "../app/api/auth/disconnect/route";

const UNAVAILABLE = "Account deletion is not available right now. Please try again later.";
const del = () =>
  deleteAccount(new Request("http://localhost/api/account/delete", { method: "POST", body: JSON.stringify({ confirm: "delete" }), headers: { "content-type": "application/json" } }));

beforeEach(() => {
  Object.assign(s, { adminThrows: null, deleteError: null, deleted: [], signOuts: 0, disconnects: 0, revokeFailed: false, gmail: { gmailEmail: "g@x.co" }, revokes: [], removed: [], removeThrows: false, removeError: null });
});

describe("POST /api/account/delete", () => {
  it("removes the profile photo through the admin client, and still succeeds if that fails", async () => {
    expect((await del()).status).toBe(200);
    expect(s.removed).toEqual([["avatars", "u1/avatar"]]);
    s.removeThrows = true;
    const res = await del();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("logs a storage error that is returned instead of thrown, and still deletes the account", async () => {
    s.removeError = { message: "storage refused" };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await del();
    expect(res.status).toBe(200);
    expect(s.deleted).toEqual(["u1"]);
    expect(log).toHaveBeenCalledWith("avatar cleanup failed", "storage refused");
    log.mockRestore();
  });

  it("answers plain JSON, keeps the session and the Gmail connection when the admin client is not configured", async () => {
    s.adminThrows = new Error("SUPABASE_SERVICE_ROLE_KEY is required");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await del();
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: UNAVAILABLE });
    expect(s.signOuts).toBe(0);
    expect(s.disconnects).toBe(0);
    // Only the message is logged, never the error object.
    expect(log).toHaveBeenCalledWith("account delete failed", "SUPABASE_SERVICE_ROLE_KEY is required");
    log.mockRestore();
  });

  it("answers plain JSON and keeps the session when deleteUser fails", async () => {
    s.deleteError = { message: "database unreachable at db.internal" };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await del();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: UNAVAILABLE });
    expect(s.signOuts).toBe(0);
    // Nothing changed: the connection is still stored and Google was not asked to revoke.
    expect(s.gmail).toEqual({ gmailEmail: "g@x.co" });
    expect(s.revokes).toEqual([]);
    expect(log).toHaveBeenCalledWith("account delete failed", "database unreachable at db.internal");
    log.mockRestore();
  });

  it("still deletes the account when the Google revoke fails, and says so", async () => {
    s.revokeFailed = true;
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, revokeFailed: true });
    expect(s.deleted).toEqual(["u1"]);
    expect(s.signOuts).toBe(1);
  });

  it("revokes from the tokens read beforehand, only after the user is deleted", async () => {
    const res = await del();
    expect(await res.json()).toEqual({ ok: true, revokeFailed: false });
    expect(s.revokes).toEqual([{ email: "g@x.co", deletedAtCall: 1 }]);
  });

  it("reports revokeFailed false on a clean delete", async () => {
    const res = await del();
    expect(await res.json()).toEqual({ ok: true, revokeFailed: false });
  });
});

describe("POST /api/auth/disconnect", () => {
  it("reports whether Google's grant was revoked", async () => {
    const post = () => disconnectRoute(new Request("http://localhost/api/auth/disconnect", { method: "POST" }));
    expect(await (await post()).json()).toEqual({ ok: true, revokeFailed: false });
    s.revokeFailed = true;
    expect(await (await post()).json()).toEqual({ ok: true, revokeFailed: true });
  });
});
