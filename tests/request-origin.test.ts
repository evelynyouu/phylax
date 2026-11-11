import { describe, expect, it } from "vitest";
import { requestOrigin } from "../lib/csrf";

const h = (o: Record<string, string>) => new Headers(o);

describe("requestOrigin", () => {
  it("uses the Host header, not the URL Next built (next start reports localhost)", () => {
    expect(requestOrigin(h({ host: "127.0.0.1:3200" }), "http://localhost:3200/auth/callback")).toBe("http://127.0.0.1:3200");
  });

  it("prefers x-forwarded-host and x-forwarded-proto from a proxy", () => {
    expect(
      requestOrigin(h({ host: "internal:3000", "x-forwarded-host": "subwatch.vercel.app", "x-forwarded-proto": "https" }), "http://internal:3000/x"),
    ).toBe("https://subwatch.vercel.app");
    // Comma lists from chained proxies: the first entry is the client-facing one.
    expect(requestOrigin(h({ host: "a", "x-forwarded-host": "app.example, b", "x-forwarded-proto": "https,http" }), "http://a/")).toBe("https://app.example");
  });

  it("takes the protocol from the request URL when no proxy says otherwise", () => {
    expect(requestOrigin(h({ host: "app.example" }), "https://localhost/x")).toBe("https://app.example");
  });

  it("falls back to the request URL's origin for a missing or malformed host or protocol", () => {
    expect(requestOrigin(h({}), "http://localhost:3200/x")).toBe("http://localhost:3200");
    expect(requestOrigin(h({ host: "evil.example/path@x" }), "http://localhost:3200/x")).toBe("http://localhost:3200");
    expect(requestOrigin(h({ host: "app.example", "x-forwarded-proto": "javascript" }), "http://localhost/x")).toBe("http://app.example");
  });

  it("falls back when the built origin is not a valid URL (out-of-range port)", () => {
    expect(requestOrigin(h({ host: "app.example:99999" }), "http://localhost:3200/x")).toBe("http://localhost:3200");
  });
});
