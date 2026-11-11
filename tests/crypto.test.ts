import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../lib/crypto";

describe("token encryption key", () => {
  const env = process.env as Record<string, string | undefined>;
  let saved: { key?: string; ds?: string; ne?: string };
  beforeEach(() => (saved = { key: env.TOKEN_ENC_KEY, ds: env.DATA_SOURCE, ne: env.NODE_ENV }));
  afterEach(() => {
    for (const [k, v] of [["TOKEN_ENC_KEY", saved.key], ["DATA_SOURCE", saved.ds], ["NODE_ENV", saved.ne]] as const) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  });

  it("requires TOKEN_ENC_KEY outside demo mode", () => {
    delete env.TOKEN_ENC_KEY;
    delete env.DATA_SOURCE;
    expect(() => encrypt("x")).toThrow("TOKEN_ENC_KEY is required");
  });

  it("requires TOKEN_ENC_KEY in production even with DATA_SOURCE=fixtures", () => {
    delete env.TOKEN_ENC_KEY;
    env.DATA_SOURCE = "fixtures";
    env.NODE_ENV = "production";
    expect(() => encrypt("x")).toThrow("TOKEN_ENC_KEY is required");
  });

  it("round-trips with a valid key and rejects a malformed one", () => {
    env.TOKEN_ENC_KEY = "c".repeat(64);
    expect(decrypt(encrypt("tokens"))).toBe("tokens");
    env.TOKEN_ENC_KEY = "short";
    expect(() => encrypt("x")).toThrow(/64 hex/);
  });
});
