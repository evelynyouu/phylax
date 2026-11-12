import { z } from "zod";

// Copy and pure checks for sign-in, sign-up and the OAuth routes. No Supabase or Next imports,
// so it is safe in client components and easy to test.

export type AuthMessage = { text: string; info?: boolean };

// Copy for ?auth= codes on /signin: Supabase sign-in failures (/auth/callback) and sign-out.
export const AUTH_MESSAGES: Record<string, AuthMessage> = {
  not_configured: { text: "Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as the README describes, or run npm run demo for sample data." },
  accounts_not_configured: { text: "Accounts are not set up yet. Add the Supabase keys as the README describes, or run npm run demo for sample data." },
  denied: { text: "Google sign-in was cancelled. Try again when you're ready." },
  failed: { text: "Google sign-in failed. Check the OAuth settings in the README and try again." },
  signed_out: { text: "You're signed out.", info: true },
};

// Copy for ?auth= codes set by the Connect Gmail flow (/api/auth/google and /api/auth/callback),
// shown on sign-up step 2 and on /app.
export const GMAIL_MESSAGES: Record<string, AuthMessage> = {
  not_configured: { text: "Connecting Gmail is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as the README describes, or run npm run demo for sample data." },
  denied: { text: "Connecting Gmail was cancelled. Try again when you're ready." },
  no_gmail: { text: "Phylax needs read-only Gmail access. On Google's screen, keep the Gmail box ticked." },
  invalid_state: { text: "Phylax could not verify the answer from Google. Please connect Gmail again." },
  failed: { text: "Connecting Gmail failed. Check the OAuth settings in the README and try again." },
  no_identity: { text: "Google did not say which Gmail account you chose. Please connect Gmail again." },
};

/**
 * Where /connect-gmail's "Continue to Google" goes. Only the known next labels travel; anything
 * else means the app (the OAuth routes map the label to a fixed path).
 */
export function googleConsentHref(next: unknown): string {
  return `/api/auth/google?next=${next === "signup" ? "signup" : "app"}`;
}

/**
 * Where a signed-in user lands when connecting Gmail fails: back where they started, with the
 * reason. `next` is the oauth_next cookie label; anything but "signup" means the app.
 */
export function gmailFailureRedirect(next: string | undefined, reason: string): string {
  const auth = encodeURIComponent(reason);
  return next === "signup" ? `/signup?step=2&auth=${auth}` : `/app?auth=${auth}`;
}

const BAD_LOGIN = "That email and password don't match.";
const EXISTS = "An account with that email already exists. Sign in instead.";
const UNCONFIRMED = "Confirm your email first. The link is in your inbox.";
const RATE_LIMITED = "Too many sign-up attempts right now. Please wait a few minutes and try again.";
const BAD_ADDRESS = "That email address can't be used. Check it and try again.";

// Supabase Auth error codes (error.code), checked first: they are stable, the messages are not.
const ERROR_CODES: Record<string, string> = {
  invalid_credentials: BAD_LOGIN,
  user_already_exists: EXISTS,
  email_exists: EXISTS,
  email_not_confirmed: UNCONFIRMED,
  over_email_send_rate_limit: RATE_LIMITED,
  email_address_invalid: BAD_ADDRESS,
};

// Supabase's wording for an address it will not accept, e.g. 'Email address "x@example.com" is invalid'.
const BAD_ADDRESS_MESSAGE = /^Email address .+ is invalid$/;

const ERRORS: Record<string, string> = {
  "Invalid login credentials": BAD_LOGIN,
  "User already registered": EXISTS,
  "Email not confirmed": UNCONFIRMED,
  "email rate limit exceeded": RATE_LIMITED,
};

/**
 * Plain copy for a Supabase Auth error: by `error.code` when known, else by message. Unknown
 * errors get a generic line, never the raw text.
 */
export function authErrorMessage(message: string, code?: string | null): string {
  return (
    (code ? ERROR_CODES[code] : undefined) ??
    ERRORS[message] ??
    (BAD_ADDRESS_MESSAGE.test(message) ? BAD_ADDRESS : undefined) ??
    "Something went wrong. Please try again."
  );
}

/** The sign-up form's answer when signUp reports an existing email (see signupAlreadyExists). */
export const ACCOUNT_EXISTS_MESSAGE = EXISTS;

/**
 * With "Confirm email" on, Supabase answers a sign-up for an existing email with success and a
 * user whose `identities` list is empty, instead of an error. Spot that answer.
 */
export function signupAlreadyExists(data: { user: { identities?: unknown[] | null } | null }): boolean {
  return Array.isArray(data.user?.identities) && data.user.identities.length === 0;
}

const NEXT_PATHS = new Set(["/app", "/signup?step=2", "/reset-password"]);

/** Where to land after the auth callback. Only known internal paths, never a raw URL. */
export function safeNext(next: string | null | undefined): string {
  return next && NEXT_PATHS.has(next) ? next : "/app";
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export type SignupErrors = Partial<Record<keyof SignupInput, string>>;

export const PASSWORD_HINT = "At least 8 characters.";

/** Field errors for the sign-up form; an empty object means the input is fine. */
export function validateSignup({ name, email, password }: SignupInput): SignupErrors {
  const errors: SignupErrors = {};
  if (!name.trim()) errors.name = "Enter your name.";
  if (!email.includes("@")) errors.email = "Enter an email address with an @.";
  if (password.length < 8) errors.password = PASSWORD_HINT;
  return errors;
}

/** Body of POST /api/account/delete. The user must have typed the word "delete". */
export const DeleteBody = z.object({ confirm: z.literal("delete") });

/** The sign-up form asks for first and last name; Supabase keeps one full_name. */
export function fullName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ");
}

export type StrengthTone = "none" | "weak" | "ok" | "strong";

/** The four-segment meter under the sign-up password, scored as in SignUp.dc.html. */
export function passwordStrength(pw: string): { score: number; tone: StrengthTone; text: string } {
  if (!pw) return { score: 0, tone: "none", text: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, tone: "weak", text: "Too easy to guess. Add length or a number." };
  if (score === 2) return { score, tone: "ok", text: "Good. Longer is stronger." };
  return { score, tone: "strong", text: "Strong password." };
}
