import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import ForgotLink from "../components/ForgotLink";
import ResetByCode from "../components/ResetByCode";
import { cleanCode, isCodeShaped, resetErrorMessage, RESEND_SECONDS } from "../lib/password-reset";

describe("reset code helpers", () => {
  it("strips spaces and dashes", () => {
    expect(cleanCode(" 123-456 ")).toBe("123456");
  });
  it("accepts 6 to 10 digits only", () => {
    expect(isCodeShaped("123456")).toBe(true);
    expect(isCodeShaped("1234567890")).toBe(true);
    expect(isCodeShaped("12345")).toBe(false);
    expect(isCodeShaped("12a456")).toBe(false);
  });
  it("waits 60 seconds before a new code", () => {
    expect(RESEND_SECONDS).toBe(60);
  });
  it("words each error", () => {
    expect(resetErrorMessage("otp_expired")).toBe("That code is wrong or has expired. Check the newest email or send a new code.");
    expect(resetErrorMessage("over_email_send_rate_limit")).toBe("Too many emails were sent. Wait a minute and try again.");
    expect(resetErrorMessage("same_password")).toBe("Choose a password you haven't used here before.");
    expect(resetErrorMessage("weak_password")).toBe("Use at least 8 characters.");
    expect(resetErrorMessage("nope")).toBe("Something went wrong. Please try again.");
    expect(resetErrorMessage()).toBe("Something went wrong. Please try again.");
  });
});

describe("ResetByCode", () => {
  it("offers to email a known address", () => {
    const html = renderToStaticMarkup(<ResetByCode initialEmail="a@b.co" />);
    expect(html).toContain("Reset your password");
    expect(html).toContain("Send a verification email to a@b.co");
    expect(html).toContain("Use a different email");
  });
  it("asks for the email when none is known", () => {
    const html = renderToStaticMarkup(<ResetByCode />);
    expect(html).toContain("Send verification email");
    expect(html).toContain("Email");
  });
});

describe("ForgotLink", () => {
  it("links to the forgot-password page", () => {
    const html = renderToStaticMarkup(<ForgotLink emailInputId="si-email" />);
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain("Forgot password?");
  });
});
