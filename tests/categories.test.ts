import { describe, expect, it } from "vitest";
import { buildDashboard } from "../lib/resolve";
import { memoryStore } from "../lib/store/memory";
import { runSync } from "../lib/sync";
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

  it("does not read inherited object members as merchants", () => {
    expect(categoryFor("constructor", "Constructor")).toBe("other");
  });

  it("labels every category and orders all 13", () => {
    expect(CATEGORY_ORDER).toHaveLength(13);
    expect(CATEGORY_LABELS.software).toBe("AI and technology");
    expect(isCategory("gaming")).toBe(true);
    expect(isCategory("crypto")).toBe(false);
  });

  it("uses the user's category over the rules, for subscriptions and bills alike", { timeout: 15000 }, async () => {
    const store = memoryStore("cat");
    await runSync(store, undefined, undefined, { source: "fixtures" });
    const records = await store.loadRecords();
    const d = buildDashboard(records, { categories: new Map([["netflix", "music"], ["pge", "housing"]]) });
    expect(d.subscriptions.find((s) => s.merchantKey === "netflix")).toMatchObject({ category: "music", categoryChosen: true });
    expect(d.subscriptions.find((s) => s.merchantKey === "openai")).toMatchObject({ category: "software", categoryChosen: false });
    expect(d.due.find((x) => x.merchantKey === "pge")?.category).toBe("housing");
    expect(d.bills.find((x) => x.merchantKey === "pge")?.category).toBe("housing");
  });
});
