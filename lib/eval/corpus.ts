import fs from "node:fs";
import path from "node:path";
import { decrypt, encrypt } from "../crypto";
import type { ListingInfo } from "./export";
import type { CorpusEntry, EvalCase, Labels } from "./types";

// Local eval corpus. It holds sampled email bodies, so every line is encrypted with the same
// AES-256-GCM key as the Gmail token, and the files are owner-only. data/ is gitignored.

export const EVAL_DIR = path.join(process.cwd(), "data", "eval");

const CORPUS_FILE = "corpus.jsonl.enc";
const LABELS_FILE = "labels.json.enc";
const META_FILE = "meta.json"; // counts and flags only, no email content, so plaintext

export interface ExportMeta extends ListingInfo {
  exportedAt: string;
}

export class CorpusKeyError extends Error {
  constructor() {
    super(
      "Cannot decrypt data/eval with the current key. It was written with a different TOKEN_ENC_KEY or data/.token-key."
    );
    this.name = "CorpusKeyError";
  }
}

function open(payload: string): unknown {
  let plain: string;
  try {
    plain = decrypt(payload);
  } catch {
    throw new CorpusKeyError();
  }
  return JSON.parse(plain);
}

function writePrivate(file: string, data: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data, { mode: 0o600 });
  fs.chmodSync(file, 0o600); // mode is ignored when the file already exists
}

export function corpusExists(dir: string): boolean {
  return fs.existsSync(path.join(dir, CORPUS_FILE));
}

/** Atomic, and refuses an empty corpus so a failed --force export cannot wipe a good one. */
export function writeCorpus(dir: string, entries: CorpusEntry[]): void {
  if (entries.length === 0) throw new Error("Refusing to write an empty corpus; nothing was exported.");
  const file = path.join(dir, CORPUS_FILE);
  writePrivate(`${file}.tmp`, entries.map((e) => encrypt(JSON.stringify(e))).join("\n") + "\n");
  fs.renameSync(`${file}.tmp`, file);
}

export function writeMeta(dir: string, meta: ExportMeta): void {
  writePrivate(path.join(dir, META_FILE), JSON.stringify(meta, null, 2));
}

export function readMeta(dir: string): ExportMeta | null {
  const file = path.join(dir, META_FILE);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as ExportMeta) : null;
}

export function readCorpus(dir: string): CorpusEntry[] {
  const file = path.join(dir, CORPUS_FILE);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => open(line) as CorpusEntry);
}

export function readLabels(dir: string): Labels {
  const file = path.join(dir, LABELS_FILE);
  if (!fs.existsSync(file)) return {};
  return open(fs.readFileSync(file, "utf8").trim()) as Labels;
}

/** Atomic: write a temp file, then rename over the old one, so an interrupt never leaves a partial file. */
export function writeLabels(dir: string, labels: Labels): void {
  const file = path.join(dir, LABELS_FILE);
  const tmp = `${file}.tmp`;
  writePrivate(tmp, encrypt(JSON.stringify(labels)));
  fs.renameSync(tmp, file);
}

/** Labeled corpus entries as eval cases, in corpus order. */
export function loadLabeledCases(dir: string): EvalCase[] {
  const labels = readLabels(dir);
  return readCorpus(dir)
    .filter((e) => labels[e.email.id] !== undefined)
    .map((e) => ({ email: e.email, expected: labels[e.email.id], samples: e.samples, inQuery: e.inQuery }));
}
