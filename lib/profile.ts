import type { AppUser } from "./current-user";

const NAME_ERROR = "Enter a name up to 80 characters.";

/** Error copy for a display name, or null when it is fine. */
export function validateName(raw: string): string | null {
  const n = raw.trim();
  return n.length >= 1 && n.length <= 80 ? null : NAME_ERROR;
}

/** Error copy for a new sign-in email, or null when it is fine. */
export function validateNewEmail(current: string, next: string): string | null {
  const n = next.trim();
  if (!n.includes("@")) return "Enter an email address with an @.";
  if (n.toLowerCase() === current.trim().toLowerCase()) return "That is already your email.";
  return null;
}

export function hasPassword(user: AppUser): boolean {
  return user.providers.includes("email");
}
