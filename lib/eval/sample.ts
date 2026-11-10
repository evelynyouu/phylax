import type { SampleSource } from "./types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher-Yates shuffle. Returns a new array; the input is untouched. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Two samples: one from the production query (scores the extractor on what sync sees) and one
 * from all mail (estimates how much billing mail the query misses). An id in both keeps both tags.
 */
export function planExport(
  queryIds: string[],
  allIds: string[],
  opts: { nQuery: number; nRandom: number; seed: number }
): Map<string, { samples: SampleSource[]; inQuery: boolean }> {
  const inQuery = new Set(queryIds);
  const plan = new Map<string, { samples: SampleSource[]; inQuery: boolean }>();
  for (const id of seededShuffle(queryIds, opts.seed).slice(0, opts.nQuery)) {
    plan.set(id, { samples: ["query"], inQuery: true });
  }
  for (const id of seededShuffle(allIds, opts.seed + 1).slice(0, opts.nRandom)) {
    const existing = plan.get(id);
    if (existing) existing.samples.push("random");
    else plan.set(id, { samples: ["random"], inQuery: inQuery.has(id) });
  }
  // Seeded interleave, so stopping partway through labeling still leaves a fair mix of both samples.
  return new Map(seededShuffle([...plan], opts.seed + 2));
}
