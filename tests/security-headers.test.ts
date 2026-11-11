import { afterEach, describe, expect, it } from "vitest";
import nextConfig from "../next.config";

const env = process.env as Record<string, string | undefined>;
const savedEnv = env.NODE_ENV;
afterEach(() => {
  env.NODE_ENV = savedEnv;
});

async function allRoutes(): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const all = rules.find((r) => r.source === "/:path*");
  expect(all, "a headers() entry for every route").toBeTruthy();
  return Object.fromEntries(all!.headers.map((h) => [h.key, h.value]));
}

describe("security headers (next.config.ts)", () => {
  it("drops X-Powered-By", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("sends the baseline headers on every route", async () => {
    env.NODE_ENV = "development";
    const h = await allRoutes();
    expect(h).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    });
  });

  it("adds HSTS only in production", async () => {
    env.NODE_ENV = "production";
    expect((await allRoutes())["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
  });
});
