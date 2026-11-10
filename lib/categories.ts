export type Category = "streaming" | "software" | "storage" | "shopping" | "learning" | "other";

export const CATEGORY_LABELS: Record<Category, string> = {
  streaming: "Streaming",
  software: "Software and AI",
  storage: "Storage",
  shopping: "Shopping",
  learning: "Learning",
  other: "Other",
};

// Keyed by merchantKey (lowercase letters and digits, see lib/extract/merchant.ts).
const CATEGORY_BY_MERCHANT: Record<string, Category> = {
  netflix: "streaming",
  hulu: "streaming",
  spotify: "streaming",
  peacock: "streaming",
  disney: "streaming",
  youtube: "streaming",
  youtubepremium: "streaming",
  max: "streaming",
  hbomax: "streaming",
  paramount: "streaming",
  appletv: "streaming",
  openai: "software",
  anthropic: "software",
  notion: "software",
  figma: "software",
  github: "software",
  adobe: "software",
  canva: "software",
  linkedin: "software",
  microsoft: "software",
  google: "software",
  apple: "storage",
  dropbox: "storage",
  icloud: "storage",
  googleone: "storage",
  box: "storage",
  amazon: "shopping",
  costco: "shopping",
  walmart: "shopping",
  target: "shopping",
  chegg: "learning",
  duolingo: "learning",
  coursera: "learning",
  masterclass: "learning",
  udemy: "learning",
  ucberkeley: "learning",
};

export function categoryFor(merchantKey: string): Category {
  return CATEGORY_BY_MERCHANT[merchantKey] ?? "other";
}
