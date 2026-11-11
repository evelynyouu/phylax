import { z } from "zod";

// Copy and pure checks for sign-in, sign-up and the OAuth routes. No Supabase or Next imports,
// so it is safe in client components and easy to test.

// Copy for ?auth= codes set by the OAuth routes and sign-out.
export const AUTH_MESSAGES: Record<string, { text: string; info?: boolean }> = {
  not_configured: { text: "Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as the README describes, or run npm run demo for sample data." },
  accounts_not_configured: { text: "Accounts are not set up yet. Add the Supabase keys as the README describes, or run npm run demo for sample data." },
  denied: { text: "Google sign-in was cancelled. Try again when you're ready." },
  invalid_state: { text: "The sign-in could not be verified. Please try again." },
  failed: { text: "Google sign-in failed. Check the OAuth settings in the README and try again." },
  no_identity: { text: "Google did not say which Gmail account you chose. Please try connecting again." },
  no_gmail: { text: "Subwatch needs read-only Gmail access to work. On Google's screen, keep the Gmail box ticked." },
  signed_out: { text: "You're signed out.", info: true },
};

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
