import type { ExtractedRecord, RawEmail } from "../types";
import { extractWithLlm } from "./llm";
import { extractWithRules, hasBillingSignal, isRelevantKind } from "./rules";

export const LLM_THRESHOLD = 0.7;

export interface ExtractOptions {
  /**
   * Default false. The AI fallback sends email text to Anthropic, so it is a local developer
   * tool: only the eval script passes true (npm run eval:llm, scripts/eval.ts --llm). Sync for
   * real users and the demo never set it.
   */
  useLlm?: boolean;
}

/** Rules first. With useLlm, the LLM only sees emails the rules could not handle confidently. */
export async function extractEmail(email: RawEmail, opts: ExtractOptions = {}): Promise<ExtractedRecord> {
  const rules = extractWithRules(email);
  if (opts.useLlm !== true) return rules;
  // Confidently rejected (e.g. spoofed sender): never escalate to the model.
  if (!rules.relevant && rules.confidence >= 0.9) return rules;

  const lowConfidenceBilling = isRelevantKind(rules.kind) && rules.confidence < LLM_THRESHOLD;
  const unclassifiedButBillingish =
    rules.kind === "other" && hasBillingSignal(`${email.subject}\n${email.bodyText}`);
  if (!lowConfidenceBilling && !unclassifiedButBillingish) return rules;

  const llm = await extractWithLlm(email);
  return llm ?? rules;
}

export async function extractAll(emails: RawEmail[], opts: ExtractOptions = {}): Promise<ExtractedRecord[]> {
  const out: ExtractedRecord[] = [];
  for (const e of emails) out.push(await extractEmail(e, opts));
  return out;
}
