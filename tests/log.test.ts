import { describe, expect, it } from "vitest";
import { errorCode, errorMessage } from "../lib/log";

describe("safe error logging helpers", () => {
  it("keep the message, capped, and nothing else", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage({ message: "supabase said no", details: "secret" })).toBe("supabase said no");
    expect(errorMessage("a string")).toBe("unknown error");
    expect(errorMessage(new Error("x".repeat(1000)))).toHaveLength(300);
  });
  it("take a short code or HTTP status", () => {
    expect(errorCode({ code: "ECONNRESET" })).toBe("ECONNRESET");
    expect(errorCode({ status: 429 })).toBe("429");
    expect(errorCode({ code: "has spaces and Bearer ya29" })).toBeNull();
    expect(errorCode(null)).toBeNull();
  });
});
