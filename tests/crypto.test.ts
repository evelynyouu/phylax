import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../lib/crypto";

describe("token encryption key", () => {
  const env = process.env as Record<string, string | undefined>;
  let saved: string | undefined;
  beforeEach(() => (saved = env.TOKEN_ENC_KEY));
  afterEach(() => {
    if (saved === undefined) delete env.TOKEN_ENC_KEY;
    else env.TOKEN_ENC_KEY = saved;
  });

  it("always requires TOKEN_ENC_KEY, even with the old DATA_SOURCE=fixtures switch set", () => {
    delete env.TOKEN_ENC_KEY;
    process.env.DATA_SOURCE = "fixtures";
    try {
      expect(() => encrypt("x")).toThrow("TOKEN_ENC_KEY is required");
    } finally {
      delete process.env.DATA_SOURCE;
    }
  });

  it("round-trips with a valid key and rejects a malformed one", () => {
    env.TOKEN_ENC_KEY = "c".repeat(64);
    expect(decrypt(encrypt("tokens"))).toBe("tokens");
    env.TOKEN_ENC_KEY = "short";
    expect(() => encrypt("x")).toThrow(/64 hex/);
  });
});
