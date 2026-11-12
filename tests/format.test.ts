import { describe, expect, it } from "vitest";
import { money } from "../lib/format";

describe("money", () => {
  it("always shows cents, as the final designs do ($10.00, Up $1.00)", () => {
    expect(money(10)).toBe("$10.00");
    expect(money(167)).toBe("$167.00");
    expect(money(15.5)).toBe("$15.50");
    expect(money(1950)).toBe("$1,950.00");
  });
  it("keeps other currencies and unknown amounts", () => {
    expect(money(20, "EUR")).toBe("€20.00");
    expect(money(null)).toBe("Amount unknown");
  });
});
