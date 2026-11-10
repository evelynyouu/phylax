import type { EmailKind, RawEmail } from "../types";

export type SampleSource = "query" | "random";

/**
 * A human label for one email. For the optional fields, `undefined` means "not labeled"
 * (skipped by the scorer) and `null` means "labeled as absent".
 */
export interface Expected {
  relevant: boolean;
  kind: EmailKind;
  merchant?: string | null;
  amount?: number | null;
  date?: string | null; // YYYY-MM-DD, compared to dueDate ?? renewalDate
  hasCancel?: boolean; // fixtures only; ignored when cancelUrl is defined
  cancelUrl?: string | null;
}

export interface EvalCase {
  email: RawEmail;
  expected: Expected;
  samples?: SampleSource[]; // undefined means a production-query email (fixtures)
  inQuery?: boolean;
}

export interface CorpusEntry {
  email: RawEmail;
  samples: SampleSource[];
  inQuery: boolean;
}

export type Labels = Record<string, Expected>; // keyed by email.id
