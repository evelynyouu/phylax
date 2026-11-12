import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, CATEGORY_ORDER, categoryFor, isCategory } from "../lib/categories";

describe("categories", () => {
  it.each([
    ["spotify", "Spotify", "music"],
    ["netflix", "Netflix", "streaming"],
    ["openai", "ChatGPT Plus", "software"],
    ["maplepropertymanagement", "Maple Property Management", "housing"],
    ["rent", "Rent", "housing"],
    ["pge", "PG&E", "utilities"],
    ["tmobile", "T-Mobile", "phone"],
    ["comcast", "Comcast Xfinity", "phone"],
    ["nintendo", "Nintendo", "gaming"],
    ["steam", "Steam", "gaming"],
    ["xboxgamepass", "Xbox Game Pass", "gaming"],
    ["citygym", "City Gym", "health"],
    ["geico", "GEICO", "insurance"],
    ["acmecloud", "Acme Cloud", "other"],
  ])("categoryFor(%s, %s) is %s", (key, name, cat) => expect(categoryFor(key, name)).toBe(cat));

  it("labels every category and orders all 13", () => {
    expect(CATEGORY_ORDER).toHaveLength(13);
    expect(CATEGORY_LABELS.software).toBe("AI and technology");
    expect(isCategory("gaming")).toBe(true);
    expect(isCategory("crypto")).toBe(false);
  });
});
