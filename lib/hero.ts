// Scroll math and sample data for the landing hero (port of Main.dc.html's Component logic).

export interface SampleSub {
  id: string;
  name: string;
  amt: number;
  per: "month" | "year";
  trial?: boolean;
}

/** Marketing sample: the visitor is not signed in, so the petals show a sample inbox, not real data. */
export const SAMPLE: SampleSub[] = [
  { id: "netflix", name: "Netflix", amt: 15.49, per: "month" },
  { id: "spotify", name: "Spotify Premium", amt: 12.99, per: "month" },
  { id: "adobe", name: "Adobe Creative Cloud", amt: 263.88, per: "year" },
  { id: "hulu", name: "Hulu", amt: 9.99, per: "month", trial: true },
  { id: "youtube", name: "YouTube Premium", amt: 13.99, per: "month" },
  { id: "amazon", name: "Amazon Prime", amt: 139, per: "year" },
  { id: "peacock", name: "Peacock", amt: 7.99, per: "month" },
  { id: "dropbox", name: "Dropbox Plus", amt: 119.88, per: "year" },
  { id: "chegg", name: "Chegg Study", amt: 19.95, per: "month", trial: true },
  { id: "duolingo", name: "Duolingo Plus", amt: 14.99, per: "month" },
  { id: "chatgpt", name: "ChatGPT Plus", amt: 20, per: "month" },
  { id: "github", name: "GitHub Copilot", amt: 10, per: "month" },
  { id: "notion", name: "Notion Plus", amt: 10, per: "month" },
  { id: "figma", name: "Figma Professional", amt: 15, per: "month" },
  { id: "icloud", name: "iCloud+", amt: 2.99, per: "month" },
];

export const yearlyOf = (s: SampleSub) => (s.per === "month" ? s.amt * 12 : s.amt);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Progress through the sticky hero. `top` is the section's getBoundingClientRect().top.
 * The camera finishes its move at 55% of the scrollable distance; the rest is time to play.
 */
export function scrollProgress(top: number, sectionHeight: number, stageHeight: number): number {
  const total = sectionHeight - stageHeight;
  if (total <= 0) return 0;
  return clamp01(clamp01(-top / total) / 0.55);
}

export function heroLayers(p: number) {
  return {
    introOpacity: Math.round(clamp01(1 - p * 1.8) * 1000) / 1000,
    introShift: Math.round(-p * 120),
    introClickable: p < 0.35,
    cueOpacity: clamp01(1 - p * 4),
    playOpacity: Math.round(clamp01((p - 0.72) / 0.25) * 1000) / 1000,
    interactive: p > 0.88,
  };
}
