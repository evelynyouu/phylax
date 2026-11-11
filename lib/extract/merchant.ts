// Merchant normalization and sender/link domain trust checks.

// Registrable domain -> canonical merchant name.
const DOMAIN_ALIASES: Record<string, string> = {
  "netflix.com": "Netflix",
  "spotify.com": "Spotify",
  "apple.com": "Apple",
  "itunes.com": "Apple",
  "icloud.com": "Apple",
  "adobe.com": "Adobe",
  "notion.so": "Notion",
  "notion.com": "Notion",
  "github.com": "GitHub",
  "openai.com": "OpenAI",
  "anthropic.com": "Anthropic",
  "google.com": "Google",
  "youtube.com": "YouTube",
  "hulu.com": "Hulu",
  "disneyplus.com": "Disney+",
  "amazon.com": "Amazon",
  "dropbox.com": "Dropbox",
  "figma.com": "Figma",
  "canva.com": "Canva",
  "linkedin.com": "LinkedIn",
  "duolingo.com": "Duolingo",
  "chegg.com": "Chegg",
  "pge.com": "PG&E",
  "tmobile.com": "T-Mobile",
  "t-mobile.com": "T-Mobile",
  "chatgpt.com": "OpenAI",
  "berkeley.edu": "UC Berkeley",
  "verizon.com": "Verizon",
  "att.com": "AT&T",
  "comcast.com": "Xfinity",
  "xfinity.com": "Xfinity",
  "calfitness.com": "Cal Fitness",
};

// Payment processors send on behalf of other merchants, so the sender is not the merchant.
const PROCESSOR_DOMAINS = new Set([
  "paypal.com",
  "stripe.com",
  "squareup.com",
  "square.com",
  "paddle.com",
  "gumroad.com",
  "venmo.com",
]);

const NOISE_WORDS =
  /\b(billing|team|support|receipts?|no-?reply|noreply|payments?|accounts?|customer (service|care)|notifications?|alerts?|info|hello|inc\.?|llc|ltd|co\.?|corp\.?|the)\b/gi;

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu"]);

export function parseFrom(from: string): { name: string; email: string; domain: string } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : from).trim().toLowerCase();
  const name = (m ? m[1] : "").trim();
  const domain = email.split("@")[1] ?? "";
  return { name, email, domain };
}

export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const last2 = parts.slice(-2);
  if (last2[1].length === 2 && SECOND_LEVEL.has(last2[0])) return parts.slice(-3).join(".");
  return last2.join(".");
}

export function cleanName(raw: string): string {
  const cleaned = raw
    .replace(NOISE_WORDS, " ")
    .replace(/[|:()\[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Removing noise words can leave separators behind ("Acme, Inc." -> "Acme, ."). Trim them,
    // keeping a final period that belongs to an abbreviation like "A.B.".
    .replace(/^[\s,.;:\-]+/, "");
  return trimTrailingSeparators(cleaned) || raw.trim();
}

const SEPARATOR = /[\s,;:\-]/;

/** Drops trailing separators and a period that follows one, scanning once from the end (no regex backtracking). */
function trimTrailingSeparators(s: string): string {
  let end = s.length;
  for (;;) {
    if (end > 0 && SEPARATOR.test(s[end - 1])) end--;
    else if (end > 1 && s[end - 1] === "." && SEPARATOR.test(s[end - 2])) end -= 2;
    else return s.slice(0, end);
  }
}

export function merchantKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function fromProcessorText(subject: string, body: string): string | null {
  const patterns = [
    /receipt from ([A-Za-z][\w&.' +-]{1,40}?)(?:\s*(?:#|\(|\.|,|$| -| \|))/i,
    /payment (?:to|for) ([A-Za-z][\w&.' +-]{1,40}?)(?:\s*(?:#|\(|\.|,|$| -| \|))/i,
    /you (?:paid|sent) .{0,15}? to ([A-Za-z][\w&.' +-]{1,40}?)(?:\s*(?:#|\(|\.|,|$))/i,
  ];
  for (const p of patterns) {
    const m = subject.match(p) ?? body.slice(0, 600).match(p);
    if (m) return m[1].trim();
  }
  return null;
}

export interface MerchantInfo {
  merchant: string | null;
  key: string | null;
  senderDomain: string;
  known: boolean; // matched the alias table
  spoofed: boolean; // display name claims a known merchant but the domain is not theirs
}

// Canonical merchant name -> every domain we know belongs to it.
const CANON_DOMAINS: Map<string, Set<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const [domain, canon] of Object.entries(DOMAIN_ALIASES)) {
    const key = merchantKey(canon);
    if (!m.has(key)) m.set(key, new Set());
    m.get(key)!.add(domain);
  }
  return m;
})();

/** "Netflix <billing@netflix-account-support.co>": the name is a known brand, the domain is not. */
export function isSpoofedSender(displayName: string, regDomain: string): boolean {
  const key = merchantKey(cleanName(displayName));
  const domains = CANON_DOMAINS.get(key);
  return !!domains && !domains.has(regDomain);
}

export function resolveMerchant(from: string, subject: string, body: string): MerchantInfo {
  const { name, domain } = parseFrom(from);
  const reg = registrableDomain(domain);
  const spoofed = isSpoofedSender(name, reg);

  if (PROCESSOR_DOMAINS.has(reg)) {
    const m = fromProcessorText(subject, body);
    if (m) return { merchant: m, key: merchantKey(m), senderDomain: reg, known: false, spoofed: false };
  }

  const alias = DOMAIN_ALIASES[reg];
  if (alias) return { merchant: alias, key: merchantKey(alias), senderDomain: reg, known: true, spoofed: false };

  const display = cleanName(name);
  if (display && display.length >= 2) {
    return { merchant: display, key: merchantKey(display), senderDomain: reg, known: false, spoofed };
  }

  // Fall back to the second-level label of the sender domain, e.g. "mail.acme.com" -> "Acme".
  const label = reg.split(".")[0];
  if (label) {
    const pretty = label.charAt(0).toUpperCase() + label.slice(1);
    return { merchant: pretty, key: merchantKey(pretty), senderDomain: reg, known: false, spoofed: false };
  }
  return { merchant: null, key: null, senderDomain: reg, known: false, spoofed: false };
}

/** A link is trusted when it points at the sender's own domain or a domain with the same canonical merchant. */
export function isTrustedLink(href: string, senderDomain: string): boolean {
  let host: string;
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return false;
    host = u.hostname;
  } catch {
    return false;
  }
  const linkReg = registrableDomain(host);
  if (linkReg === senderDomain) return true;
  const a = DOMAIN_ALIASES[linkReg];
  const b = DOMAIN_ALIASES[senderDomain];
  return !!a && a === b;
}
