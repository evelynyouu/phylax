import { describe, expect, it } from "vitest";
import { heroLayers, scrollProgress, yearlyOf, SAMPLE } from "../lib/hero";

describe("hero scroll", () => {
  it("maps the section's scroll position to 0..1, reaching 1 at 55% of the scrollable distance", () => {
    // section 1700 tall, stage 780 tall: 920px of scroll
    expect(scrollProgress(0, 1700, 780)).toBe(0);
    expect(scrollProgress(-253, 1700, 780)).toBeCloseTo(0.5, 2);
    expect(scrollProgress(-506, 1700, 780)).toBe(1);
    expect(scrollProgress(-1500, 1700, 780)).toBe(1);
    expect(scrollProgress(300, 1700, 780)).toBe(0);
    expect(scrollProgress(0, 500, 780)).toBe(0);
  });

  it("fades the intro out, then the controls in, and only then turns on interaction", () => {
    expect(heroLayers(0)).toMatchObject({ introOpacity: 1, playOpacity: 0, interactive: false, introClickable: true });
    const mid = heroLayers(0.5);
    expect(mid.introOpacity).toBe(0.1);
    expect(mid.playOpacity).toBe(0);
    expect(mid.introClickable).toBe(false);
    expect(heroLayers(0.85).interactive).toBe(false);
    expect(heroLayers(1)).toMatchObject({ introOpacity: 0, playOpacity: 1, interactive: true });
  });
});

describe("sample bouquet", () => {
  it("has 15 sample subscriptions, one per mapped petal", () => {
    expect(SAMPLE).toHaveLength(15);
    expect(new Set(SAMPLE.map((s) => s.id)).size).toBe(15);
  });
  it("annualizes monthly prices and keeps yearly ones", () => {
    expect(yearlyOf({ id: "x", name: "X", amt: 10, per: "month" })).toBe(120);
    expect(yearlyOf({ id: "y", name: "Y", amt: 139, per: "year" })).toBe(139);
  });
});
