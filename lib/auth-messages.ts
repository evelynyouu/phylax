// Copy for ?auth= codes set by the OAuth routes.
export const AUTH_MESSAGES: Record<string, { text: string; info?: boolean }> = {
  not_configured: { text: "Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as the README describes, or run npm run demo for sample data." },
  denied: { text: "Google sign-in was cancelled. Try again when you're ready." },
  invalid_state: { text: "The sign-in could not be verified. Please try again." },
  failed: { text: "Google sign-in failed. Check the OAuth settings in the README and try again." },
  not_owner: { text: "This Subwatch is connected to a different Google account. Sign in with that account, or disconnect it first." },
  no_identity: { text: "Google did not share which account you used. Please try again." },
  no_gmail: { text: "Subwatch needs read-only Gmail access to work. On Google's screen, keep the Gmail box ticked." },
  signed_out: { text: "You're signed out.", info: true },
};
