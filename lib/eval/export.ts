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

/**
 * The export reads a whole mailbox with the service role key and the labeler shows it to a
 * person, so it may only run on the developer's own account: --user must equal
 * EVAL_OWNER_USER_ID. Returns the reason to refuse, or null when allowed.
 */
export function evalOwnerError(userId: string, owner: string | undefined): string | null {
  const o = owner?.trim();
  if (!o) return "Set EVAL_OWNER_USER_ID in .env.local to your own Subwatch account id. The export only reads that account.";
  if (userId.toLowerCase() !== o.toLowerCase()) {
    return "Refusing: --user is not EVAL_OWNER_USER_ID. The eval export may only read your own account, never another user's mail.";
  }
  return null;
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
