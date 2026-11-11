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
  no_gmail: { text: "Subwatch needs read-only Gmail access. On Google's screen, keep the Gmail box ticked." },
  invalid_state: { text: "Subwatch could not verify the answer from Google. Please connect Gmail again." },
  failed: { text: "Connecting Gmail failed. Check the OAuth settings in the README and try again." },
  no_identity: { text: "Google did not say which Gmail account you chose. Please connect Gmail again." },
};

/**
 * Where a signed-in user lands when connecting Gmail fails: back where they started, with the
 * reason. `next` is the oauth_next cookie label; anything but "signup" means the app.
 */
export function gmailFailureRedirect(next: string | undefined, reason: string): string {
  const auth = encodeURIComponent(reason);
  return next === "signup" ? `/signup?step=2&auth=${auth}` : `/app?auth=${auth}`;
}

const ERRORS: Record<string, string> = {
  "Invalid login credentials": "That email and password don't match.",
  "User already registered": "An account with that email already exists. Sign in instead.",
  "Email not confirmed": "Confirm your email first. The link is in your inbox.",
};

/** Plain copy for a Supabase Auth error message. Unknown errors get a generic line, never the raw text. */
export function authErrorMessage(message: string): string {
  return ERRORS[message] ?? "Something went wrong. Please try again.";
}

const NEXT_PATHS = new Set(["/app", "/signup?step=2"]);

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
