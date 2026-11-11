import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDemo } from "./session";

// AES-256-GCM for OAuth tokens at rest. The key comes from TOKEN_ENC_KEY (64 hex chars).
// It is required everywhere except demo mode, which may fall back to a generated local key
// file (data/.token-key, 0600). A server never invents its own key: tokens written with one
// would be unreadable after a redeploy.

function loadKey(): Buffer {
  const env = process.env.TOKEN_ENC_KEY;
  if (env) {
    if (!/^[0-9a-fA-F]{64}$/.test(env)) throw new Error("TOKEN_ENC_KEY must be 64 hex characters");
    return Buffer.from(env, "hex");
  }
  if (!isDemo()) throw new Error("TOKEN_ENC_KEY is required");
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
