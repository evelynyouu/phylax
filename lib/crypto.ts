import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// AES-256-GCM for OAuth tokens at rest. The key comes from TOKEN_ENC_KEY (64 hex chars)
// or, for local use, a generated key file next to the database with 0600 permissions.

function loadKey(): Buffer {
  const env = process.env.TOKEN_ENC_KEY;
  if (env) {
    if (!/^[0-9a-fA-F]{64}$/.test(env)) throw new Error("TOKEN_ENC_KEY must be 64 hex characters");
    return Buffer.from(env, "hex");
  }
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, ".token-key");
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file)) return Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, key.toString("hex"), { mode: 0o600 });
  return key;
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", loadKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", loadKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** A purpose-specific key derived from the token key, so one secret never serves two jobs. */
export function deriveKey(label: string): Buffer {
  return crypto.createHmac("sha256", loadKey()).update(label).digest();
}
