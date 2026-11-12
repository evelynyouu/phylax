import { describe, expect, it } from "vitest";
import { fullName, passwordStrength, safeNext } from "../lib/auth-copy";

describe("password strength meter (SignUp.dc.html)", () => {
  it("scores length, letters with numbers, and symbols", () => {
    expect(passwordStrength("")).toEqual({ score: 0, tone: "none", text: "" });
    expect(passwordStrength("short")).toMatchObject({ score: 0, tone: "weak", text: "Too easy to guess. Add length or a number." });
    expect(passwordStrength("abcdefgh")).toMatchObject({ score: 1, tone: "weak" });
    expect(passwordStrength("abcdefg1")).toMatchObject({ score: 2, tone: "ok", text: "Good. Longer is stronger." });
    expect(passwordStrength("abcdefghijk1")).toMatchObject({ score: 3, tone: "strong", text: "Strong password." });
    expect(passwordStrength("abcdefghijk1!")).toMatchObject({ score: 4, tone: "strong" });
  });
});

describe("sign-up name", () => {
  it("joins first and last name and trims", () => {
    expect(fullName(" Evelyn ", " You ")).toBe("Evelyn You");
    expect(fullName("Evelyn", "")).toBe("Evelyn");
    expect(fullName("", "")).toBe("");
  });
});

describe("password reset", () => {
  it("lets the auth callback land on the reset page and nowhere new", () => {
    expect(safeNext("/reset-password")).toBe("/reset-password");
    expect(safeNext("https://evil.example/reset-password")).toBe("/app");
  });
});
