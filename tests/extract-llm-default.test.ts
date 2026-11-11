import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The AI fallback sends email text to a third party, so it is a local developer tool: off unless
// a caller passes useLlm: true (only scripts/eval.ts --llm does).
const llm = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../lib/extract/llm", () => ({
  llmAvailable: () => true,
  extractWithLlm: async () => {
    llm.calls++;
    return null;
  },
}));

import { extractEmail } from "../lib/extract";
import { extractWithRules } from "../lib/extract/rules";
import type { RawEmail } from "../lib/types";

const env = process.env as Record<string, string | undefined>;
const savedKey = env.ANTHROPIC_API_KEY;
beforeEach(() => {
  env.ANTHROPIC_API_KEY = "sk-test";
  llm.calls = 0;
});
afterEach(() => {
  if (savedKey === undefined) delete env.ANTHROPIC_API_KEY;
  else env.ANTHROPIC_API_KEY = savedKey;
});

// A low-confidence receipt from an unknown sender: exactly what the fallback is for.
const unclear: RawEmail = {
  id: "x1",
  from: "Someone <hello@unknown-shop.example>",
  subject: "Your receipt",
  date: "2026-10-01T12:00:00Z",
  bodyText: "Thanks.",
  links: [],
};

describe("extractEmail and the AI fallback", () => {
  it("would escalate this email when the caller opts in (control)", async () => {
    await extractEmail(unclear, { useLlm: true });
    expect(llm.calls).toBe(1);
  });

  it("never calls the LLM with no options, even with ANTHROPIC_API_KEY set", async () => {
    const rec = await extractEmail(unclear);
    expect(llm.calls).toBe(0);
    expect(rec).toEqual(extractWithRules(unclear));
  });
});
