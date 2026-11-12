export type EmailKind =
  | "receipt"
  | "renewal_notice"
  | "trial_ending"
  | "payment_due"
  | "price_change"
  | "cancellation"
  | "marketing"
  | "other";

export type Cadence = "weekly" | "monthly" | "quarterly" | "semiannual" | "yearly";

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
  /** YYYY-MM-DD the money moved, for receipts: an explicit order/charge date, else the email date. Older records omit it. */
  chargeDate?: string;
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
  manualCancel: boolean; // the user said "I've cancelled it" and no newer receipt has arrived
  edited: boolean; // the user corrected one or more fields
  manual: boolean; // the user added this recurring payment by hand; no email behind it
}

export interface UpcomingPayment {
  merchant: string;
  merchantKey: string;
  amount: number | null;
  currency: string;
  date: string;
  source: "subscription" | "bill";
  daysAway: number;
}

export interface DueItem {
  key: string; // stable id: merchantKey|kind|date
  merchant: string;
  merchantKey: string;
  label: string;
  amount: number | null;
  currency: string;
  date: string;
  daysAway: number;
  kind: "payment_due" | "trial_ending" | "renewal_notice";
  cancelUrl: string | null;
  cancelUrlTrusted: boolean;
  paid: boolean; // payment_due only
  reminder: boolean; // payment_due only
}

/** A bill (payment_due) with its due date, newest email per merchant and date. */
export interface BillItem {
  key: string; // merchantKey|dueDate
  merchantKey: string;
  merchant: string;
  amount: number | null;
  currency: string;
  dueDate: string;
  paid: boolean;
  reminder: boolean;
}

/** A charge that already happened, from a receipt email. */
export interface PastCharge {
  merchantKey: string;
  merchant: string;
  amount: number | null;
  currency: string;
  date: string;
}

export interface Dashboard {
  generatedAt: string;
  subscriptions: Subscription[];
  upcoming: UpcomingPayment[];
  due: DueItem[];
  bills: BillItem[];
  receipts: PastCharge[];
  totals: { monthly: number; yearly: number; count: number };
}
