import { describe, expect, it } from "vitest";
import { gate } from "../lib/gate";
import { checkOwner, createSessionToken, verifySessionToken } from "../lib/session";

const KEY = Buffer.alloc(32, 7);
const NOW = Date.parse("2026-11-10T12:00:00Z");
const USER = { email: "me@example.com", name: "Evelyn You" };

describe("session tokens", () => {
  it("round-trips a signed session", () => {
    const t = createSessionToken(USER, KEY, NOW);
    expect(verifySessionToken(t, KEY, NOW + 1000)).toEqual(USER);
  });

  it("rejects a tampered payload or signature", () => {
    const t = createSessionToken(USER, KEY, NOW);
    const [payload, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...USER, email: "x@evil.example", exp: NOW + 1e9 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`, KEY, NOW)).toBeNull();
    expect(verifySessionToken(`${payload}.${sig.slice(0, -2)}AA`, KEY, NOW)).toBeNull();
    expect(verifySessionToken(t, Buffer.alloc(32, 8), NOW)).toBeNull();
  });

  it("rejects an expired session and garbage input", () => {
    const t = createSessionToken(USER, KEY, NOW);
    expect(verifySessionToken(t, KEY, NOW + 31 * 86400000)).toBeNull();
    for (const bad of ["", "abc", "a.b.c", ".", "not-base64.zz"]) expect(verifySessionToken(bad, KEY, NOW)).toBeNull();
    expect(verifySessionToken(undefined, KEY, NOW)).toBeNull();
  });
});

describe("single owner", () => {
  it("accepts the first account and the same account again, case-insensitively", () => {
    expect(checkOwner(null, "Me@Example.com")).toBe(true);
    expect(checkOwner("me@example.com", "ME@example.com")).toBe(true);
  });
  it("refuses a different Google account", () => {
    expect(checkOwner("me@example.com", "someone@else.com")).toBe(false);
  });
});

describe("route gate", () => {
  it("lets signed-in users through", () => {
    expect(gate({ path: "/app/bills", method: "GET", signedIn: true })).toBe("next");
    expect(gate({ path: "/api/sync", method: "POST", signedIn: true })).toBe("next");
  });
  it("redirects signed-out page visits to sign-in", () => {
    expect(gate({ path: "/app", method: "GET", signedIn: false })).toBe("signin");
    expect(gate({ path: "/app/calendar", method: "GET", signedIn: false })).toBe("signin");
  });
  it("answers 401 for signed-out API mutations", () => {
    for (const p of ["/api/sync", "/api/dismiss", "/api/auth/disconnect", "/api/bills/paid", "/api/bills/reminder", "/api/cancelled"]) {
      expect(gate({ path: p, method: "POST", signedIn: false })).toBe("unauthorized");
    }
  });
  it("leaves public pages and the auth flow open", () => {
    for (const p of ["/", "/signin", "/signup", "/style", "/api/auth/google", "/api/auth/callback", "/api/auth/signout", "/application"]) {
      expect(gate({ path: p, method: "GET", signedIn: false })).toBe("next");
    }
    expect(gate({ path: "/api/auth/signout", method: "POST", signedIn: false })).toBe("next");
  });
});
