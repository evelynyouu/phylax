import { authErrorMessage } from "./auth-copy";

// Pure helpers for the emailed-code password reset. No Supabase or Next imports.

/** Seconds before "Send a new code" works again. */
export const RESEND_SECONDS = 60;

/** The code as typed: spaces and dashes (from copy and paste) removed. */
export function cleanCode(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/** Whether the code looks like one Supabase sends: 6 to 10 digits. */
export function isCodeShaped(code: string): boolean {
  return /^\d{6,10}$/.test(code);
}

const RESET_ERRORS: Record<string, string> = {
  otp_expired: "That code is wrong or has expired. Check the newest email or send a new code.",
  over_email_send_rate_limit: "Too many emails were sent. Wait a minute and try again.",
  same_password: "Choose a password you haven't used here before.",
  weak_password: "Use at least 8 characters.",
};

/** Plain copy for a Supabase error code during the reset; unknown codes use authErrorMessage. */
export function resetErrorMessage(code?: string | null): string {
  return (code ? RESET_ERRORS[code] : undefined) ?? authErrorMessage("", code);
}

/**
 * What to show after asking for a code. From step 1 ("email") the answer is always the same, whatever
 * Supabase said: the per-user rate limit is only checked once an account is found, so showing it there
 * would reveal which addresses have accounts. On "Send a new code" (step 2) the person has already
 * moved on, so the rate limit is shown.
 */
export function sendOutcome(from: "email" | "code", error?: { code?: string | null } | null): { error: string } {
  if (from === "code" && error?.code === "over_email_send_rate_limit") return { error: resetErrorMessage(error.code) };
  return { error: "" };
}
