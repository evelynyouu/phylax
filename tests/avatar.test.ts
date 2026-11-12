import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({
  denied: null as null | number,
  uploads: [] as { bucket: string; path: string; opts: unknown }[],
  removes: [] as { bucket: string; paths: string[] }[],
  updates: [] as { data: Record<string, unknown> }[],
  uploadError: null as { message: string } | null,
}));

vi.mock("@/lib/route-auth", () => ({
  requireUser: async () => (s.denied ? { denied: NextResponse.json({ error: "no" }, { status: s.denied }) } : { user: { id: "u1", email: "u@x.co", name: "U" } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      updateUser: async (a: { data: Record<string, unknown> }) => {
        s.updates.push(a);
        return { error: null };
      },
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _body: unknown, opts: unknown) => {
          if (s.uploadError) return { error: s.uploadError };
          s.uploads.push({ bucket, path, opts });
          return { error: null };
        },
        remove: async (paths: string[]) => {
          s.removes.push({ bucket, paths });
          return { error: null };
        },
      }),
    },
  }),
}));

import { DELETE, POST } from "../app/api/account/avatar/route";
import { AVATAR_MAX_BYTES, avatarObjectPath, avatarSignedUrl, sniffImage } from "../lib/avatar";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const WEBP = [...Buffer.from("RIFF"), 1, 0, 0, 0, ...Buffer.from("WEBP")];
const GIF = [...Buffer.from("GIF89a"), 0, 0, 0, 0, 0, 0];
const HEIC = [0, 0, 0, 24, ...Buffer.from("ftypheic"), 0, 0, 0, 0];
const TEXT = [...Buffer.from("hello world, not an image")];
const BAD = "Use a PNG, JPEG or WebP image under 2 MB.";

const up = (bytes: number[] | Uint8Array, name = "me.png", type = "image/png") => {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return new Request("http://localhost/api/account/avatar", { method: "POST", body: fd });
};

beforeEach(() => {
  Object.assign(s, { denied: null, uploads: [], removes: [], updates: [], uploadError: null });
});

describe("sniffImage", () => {
  it("accepts PNG, JPEG and WebP by magic bytes", () => {
    expect(sniffImage(new Uint8Array(PNG))).toBe("image/png");
    expect(sniffImage(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array(WEBP))).toBe("image/webp");
  });
  it("rejects text, GIF and HEIC", () => {
    for (const b of [TEXT, GIF, HEIC, []]) expect(sniffImage(new Uint8Array(b))).toBeNull();
  });
});

describe("avatar helpers", () => {
  it("builds the object path and limit", () => {
    expect(avatarObjectPath("u1")).toBe("u1/avatar");
    expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
  it("signs for an hour and returns null on error or no path", async () => {
    const calls: unknown[][] = [];
    const client = (res: unknown, throws = false) =>
      ({ storage: { from: () => ({ createSignedUrl: async (...a: unknown[]) => { calls.push(a); if (throws) throw new Error("x"); return res; } }) } }) as never;
    expect(await avatarSignedUrl(client({ data: { signedUrl: "https://s/x" }, error: null }), "u1/avatar")).toBe("https://s/x");
    expect(calls[0]).toEqual(["u1/avatar", 3600]);
    expect(await avatarSignedUrl(client({ data: null, error: { message: "no" } }), "u1/avatar")).toBeNull();
    expect(await avatarSignedUrl(client(null, true), "u1/avatar")).toBeNull();
    expect(await avatarSignedUrl(client({}), null)).toBeNull();
  });
});

describe("POST /api/account/avatar", () => {
  it("refuses signed-out requests", async () => {
    s.denied = 401;
    expect((await POST(up(PNG))).status).toBe(401);
  });
  it("rejects non-images and over-size files without uploading", async () => {
    for (const req of [up(TEXT, "me.png", "image/png"), up(GIF, "me.png"), up(HEIC, "me.jpg", "image/jpeg"), up(new Uint8Array(AVATAR_MAX_BYTES + 1).fill(1))]) {
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: BAD });
    }
    const empty = await POST(new Request("http://localhost/api/account/avatar", { method: "POST", body: new FormData() }));
    expect(empty.status).toBe(400);
    expect(s.uploads).toEqual([]);
    expect(s.updates).toEqual([]);
  });
  it("uploads to u1/avatar with the sniffed type and records the path", async () => {
    const res = await POST(up(JPEG, "evil.png", "image/png"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(s.uploads).toEqual([{ bucket: "avatars", path: "u1/avatar", opts: { upsert: true, contentType: "image/jpeg" } }]);
    expect(s.updates).toHaveLength(1);
    expect(s.updates[0].data.avatar_path).toBe("u1/avatar");
    expect(typeof s.updates[0].data.avatar_updated).toBe("string");
  });
  it("answers a generic 500 when storage fails", async () => {
    s.uploadError = { message: "bucket secret internals" };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(up(PNG));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internals");
    expect(s.updates).toEqual([]);
    log.mockRestore();
  });
});

describe("DELETE /api/account/avatar", () => {
  it("removes the object and clears avatar_path", async () => {
    const res = await DELETE(new Request("http://localhost/api/account/avatar", { method: "DELETE" }));
    expect(await res.json()).toEqual({ ok: true });
    expect(s.removes).toEqual([{ bucket: "avatars", paths: ["u1/avatar"] }]);
    expect(s.updates[0].data.avatar_path).toBeNull();
  });
});
