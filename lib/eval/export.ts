import { syncQuery } from "../gmail";
import { inBatches } from "../sync";
import type { RawEmail } from "../types";
import { planExport } from "./sample";
import type { CorpusEntry } from "./types";

export interface ExportDeps {
  listIds(q: string, max: number): Promise<string[]>;
  fetchEmail(id: string): Promise<RawEmail | null>;
}

export interface ExportOptions {
  nQuery: number;
  nRandom: number;
  seed: number;
  queryMax: number;
  allMax: number;
}

export interface ListingInfo {
  queryListed: number;
  allListed: number;
  queryCapped: boolean; // the listing stopped at queryMax, so older matches were not seen
  allCapped: boolean;
}

export const ALL_MAIL_QUERY = "-in:spam -in:trash newer_than:400d";

const CONCURRENCY = 5;

/** Lists both samples, then fetches each message. A message that fails to fetch is skipped and counted. */
export async function exportCorpus(
  deps: ExportDeps,
  opts: ExportOptions
): Promise<{ entries: CorpusEntry[]; failed: number; listing: ListingInfo }> {
  const queryIds = await deps.listIds(syncQuery(null), opts.queryMax);
  const allIds = await deps.listIds(ALL_MAIL_QUERY, opts.allMax);
  const plan = [...planExport(queryIds, allIds, opts)];
  let failed = 0;
  const fetched = await inBatches(plan, CONCURRENCY, async ([id, meta]) => {
    try {
      const email = await deps.fetchEmail(id);
      if (!email) {
        failed++;
        return null;
      }
      return { email, ...meta } satisfies CorpusEntry;
    } catch {
      failed++;
      return null;
    }
  });
  const listing: ListingInfo = {
    queryListed: queryIds.length,
    allListed: allIds.length,
    queryCapped: queryIds.length >= opts.queryMax,
    allCapped: allIds.length >= opts.allMax,
  };
  return { entries: fetched.filter((e): e is CorpusEntry => e !== null), failed, listing };
}
