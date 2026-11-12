export type Category =
  | "housing"
  | "utilities"
  | "phone"
  | "software"
  | "streaming"
  | "music"
  | "gaming"
  | "storage"
  | "shopping"
  | "learning"
  | "health"
  | "insurance"
  | "other";

export const CATEGORY_LABELS: Record<Category, string> = {
  housing: "Housing and rent",
  utilities: "Utilities",
  phone: "Phone and internet",
  software: "AI and technology",
  streaming: "Streaming",
  music: "Music",
  gaming: "Gaming",
  storage: "Storage",
  shopping: "Shopping",
  learning: "Learning",
  health: "Health and fitness",
  insurance: "Insurance",
  other: "Other",
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as Category[];

export function isCategory(x: unknown): x is Category {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, x);
}

// Keyed by merchantKey (lowercase letters and digits, see lib/extract/merchant.ts).
const CATEGORY_BY_MERCHANT: Record<string, Category> = {
  netflix: "streaming",
  hulu: "streaming",
  spotify: "music",
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
  pge: "utilities",
  tmobile: "phone",
  verizon: "phone",
  att: "phone",
  comcast: "phone",
  xfinity: "phone",
  nintendo: "gaming",
  steam: "gaming",
  playstation: "gaming",
  xbox: "gaming",
  geico: "insurance",
  progressive: "insurance",
  statefarm: "insurance",
  lemonade: "insurance",
  peloton: "health",
  classpass: "health",
  strava: "health",
  tidal: "music",
  pandora: "music",
  applemusic: "music",
};

// Keyword rules for merchants not in the map, tested in order against name and key.
const RULES: [Category, RegExp][] = [
  ["housing", /\b(rent|property|properties|apartments?|realty|leasing|landlord|hoa)\b|propertymanagement/],
  ["utilities", /\b(electric|power|energy|gas|water|sewer|utility|utilities|pg&e|edison)\b/],
  ["phone", /\b(wireless|mobile|cellular|internet|broadband|fiber|cable)\b|t-mobile/],
  ["gaming", /\b(xbox|playstation|psn|nintendo|steam|epic games|game pass|gaming|twitch)\b/],
  ["music", /\b(music|tidal|pandora|soundcloud)\b/],
  ["health", /\b(gym|fitness|yoga|peloton|health|clinic|dental|pharmacy)\b/],
  ["insurance", /\b(insurance|assurance|geico|allstate)\b/],
];

export function categoryFor(merchantKey: string, merchantName?: string): Category {
  const known = CATEGORY_BY_MERCHANT[merchantKey];
  if (known) return known;
  const text = `${merchantName ?? ""} ${merchantKey}`.toLowerCase();
  for (const [category, re] of RULES) if (re.test(text)) return category;
  return "other";
}
