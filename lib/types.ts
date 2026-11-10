export type EmailKind =
  | "receipt"
  | "renewal_notice"
  | "trial_ending"
  | "payment_due"
  | "price_change"
  | "cancellation"
  | "marketing"
  | "other";

export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

export interface EmailLink {
  href: string;
  text: string;
}

export interface RawEmail {
  id: string;
  from: string; // full header, e.g. "Netflix <info@mailer.netflix.com>"
  subject: string;
  date: string; // ISO timestamp
  bodyText: string;
  links: EmailLink[];
}

export interface ExtractedRecord {
  emailId: string;
  emailDate: string;
  kind: EmailKind;
  relevant: boolean; // billing-relevant: false for marketing and unrelated mail
  merchant: string | null; // normalized display name
  merchantKey: string | null; // stable lowercase key used for grouping
  amount: number | null;
  currency: string | null;
  cadence: Cadence | null;
  dueDate: string | null; // YYYY-MM-DD, a payment or trial deadline
  renewalDate: string | null; // YYYY-MM-DD, the next automatic charge
  cancelUrl: string | null;
  cancelUrlTrusted: boolean; // false when the link domain does not match the sender
  confidence: number; // 0..1
  method: "rules" | "llm";
}

export interface Subscription {
  merchantKey: string;
  merchant: string;
  status: "active" | "trial" | "cancelled";
  amount: number | null;
  currency: string;
  cadence: Cadence | null;
  lastChargeDate: string | null;
  nextChargeDate: string | null;
  priceChange: { from: number | null; to: number; effective: string | null } | null;
  cancelUrl: string | null;
  cancelUrlTrusted: boolean;
  evidenceEmailIds: string[];
  annualCost: number | null;
}

export interface UpcomingPayment {
  merchant: string;
  amount: number | null;
  currency: string;
  date: string;
  source: "subscription" | "bill";
  daysAway: number;
}

export interface DueItem {
  merchant: string;
  label: string;
  amount: number | null;
  currency: string;
  date: string;
  daysAway: number;
  kind: "payment_due" | "trial_ending" | "renewal_notice";
  cancelUrl: string | null;
  cancelUrlTrusted: boolean;
}

export interface Dashboard {
  generatedAt: string;
  subscriptions: Subscription[];
  upcoming: UpcomingPayment[];
  due: DueItem[];
  totals: { monthly: number; yearly: number; count: number };
}
