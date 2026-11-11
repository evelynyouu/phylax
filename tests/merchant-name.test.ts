import { describe, expect, it } from "vitest";
import { cleanName } from "../lib/extract/merchant";

describe("merchant name cleanup", () => {
  it("drops stray trailing punctuation", () => {
    expect(cleanName("Myerhoff & Associates, .")).toBe("Myerhoff & Associates");
    expect(cleanName("Acme, Inc.")).toBe("Acme");
    expect(cleanName("Shop -")).toBe("Shop");
    expect(cleanName(", Leading Co")).toBe("Leading");
  });
  it("keeps internal punctuation and abbreviations", () => {
    expect(cleanName("A.B. Shop")).toBe("A.B. Shop");
    expect(cleanName("PG&E")).toBe("PG&E");
    expect(cleanName("T-Mobile")).toBe("T-Mobile");
  });
});
