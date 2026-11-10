import type { ExtractedRecord, RawEmail } from "../types";
import { extractWithLlm, llmAvailable } from "./llm";
import { extractWithRules, hasBillingSignal, isRelevantKind } from "./rules";

export const LLM_THRESHOLD = 0.7;

export interface ExtractOptions {
  useLlm?: boolean; // default: true when an API key is set
}

/** Rules first. The LLM only sees emails the rules could not handle confidently. */
export async function extractEmail(email: RawEmail, opts: ExtractOptions = {}): Promise<ExtractedRecord> {
  const rules = extractWithRules(email);
  const useLlm = opts.useLlm ?? llmAvailable();
  if (!useLlm) return rules;
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
