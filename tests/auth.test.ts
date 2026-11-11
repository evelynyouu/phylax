import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES, authErrorMessage, DeleteBody, GMAIL_MESSAGES, gmailFailureRedirect, safeNext, validateSignup } from "../lib/auth-copy";
import { gate } from "../lib/gate";

describe("auth copy", () => {
  it("maps auth errors to plain copy", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe("That email and password don't match.");
    expect(authErrorMessage("User already registered")).toBe("An account with that email already exists. Sign in instead.");
    expect(authErrorMessage("anything else")).toBe("Something went wrong. Please try again.");
  });
  it("only follows whitelisted next paths after the auth callback", () => {
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/signup?step=2")).toBe("/signup?step=2");
    for (const bad of ["https://evil.example", "//evil.example", "/app@evil", "", null]) expect(safeNext(bad)).toBe("/app");
  });
  it("validates sign-up input", () => {
    expect(validateSignup({ name: "", email: "a@b.co", password: "12345678" })).toEqual({ name: "Enter your name." });
    expect(validateSignup({ name: "E", email: "nope", password: "short" })).toEqual({ email: "Enter an email address with an @.", password: "At least 8 characters." });
  });
});

describe("Gmail connect failures", () => {
  it("send a signed-in user back to where the connect started, never to /signin", () => {
    expect(gmailFailureRedirect("signup", "denied")).toBe("/signup?step=2&auth=denied");
    expect(gmailFailureRedirect("app", "no_gmail")).toBe("/app?auth=no_gmail");
    expect(gmailFailureRedirect(undefined, "failed")).toBe("/app?auth=failed");
    expect(gmailFailureRedirect("https://evil.example", "invalid_state")).toBe("/app?auth=invalid_state");
  });

  it("have Gmail wording for every callback reason, separate from sign-in wording", () => {
    for (const r of ["denied", "no_gmail", "invalid_state", "failed", "no_identity", "not_configured"]) {
      expect(GMAIL_MESSAGES[r]?.text).toBeTruthy();
    }
    expect(GMAIL_MESSAGES.denied.text).toBe("Connecting Gmail was cancelled. Try again when you're ready.");
    expect(GMAIL_MESSAGES.no_gmail.text).toBe("Subwatch needs read-only Gmail access. On Google's screen, keep the Gmail box ticked.");
    expect(AUTH_MESSAGES.denied.text).toBe("Google sign-in was cancelled. Try again when you're ready.");
    for (const m of [...Object.values(GMAIL_MESSAGES), ...Object.values(AUTH_MESSAGES)]) expect(m.text).not.toMatch(/\u2014/);
  });
});

describe("route gate", () => {
  it("lets signed-in users through", () => {
    expect(gate({ path: "/app/bills", method: "GET", signedIn: true })).toBe("next");
    expect(gate({ path: "/api/sync", method: "POST", signedIn: true })).toBe("next");
  });
  it("redirects signed-out page visits to sign-in", () => {
    expect(gate({ path: "/app", method: "GET", signedIn: false })).toBe("signin");
    expect(gate({ path: "/app/calendar", method: "GET", signedIn: false })).toBe("signin");
  });
  it("answers 401 for signed-out API mutations", () => {
    for (const p of ["/api/sync", "/api/dismiss", "/api/auth/disconnect", "/api/bills/paid", "/api/bills/reminder", "/api/cancelled"]) {
      expect(gate({ path: p, method: "POST", signedIn: false })).toBe("unauthorized");
    }
  });
  it("leaves public pages and the auth flow open", () => {
    for (const p of ["/", "/signin", "/signup", "/style", "/api/auth/google", "/api/auth/callback", "/api/auth/signout", "/application"]) {
      expect(gate({ path: p, method: "GET", signedIn: false })).toBe("next");
    }
    expect(gate({ path: "/api/auth/signout", method: "POST", signedIn: false })).toBe("next");
  });
});

describe("account deletion", () => {
  it("refuses account deletion without the typed confirmation", () => {
    expect(DeleteBody.safeParse({ confirm: "delete" }).success).toBe(true);
    expect(DeleteBody.safeParse({ confirm: "yes" }).success).toBe(false);
    expect(DeleteBody.safeParse({}).success).toBe(false);
  });
});
