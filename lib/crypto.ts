import crypto from "node:crypto";

// AES-256-GCM for OAuth tokens at rest. The key comes from TOKEN_ENC_KEY (64 hex chars) and is
// always required: a server never invents its own key, because tokens written with one would be
// unreadable after a redeploy.

function loadKey(): Buffer {
  const env = process.env.TOKEN_ENC_KEY;
  if (!env) throw new Error("TOKEN_ENC_KEY is required");
  if (!/^[0-9a-fA-F]{64}$/.test(env)) throw new Error("TOKEN_ENC_KEY must be 64 hex characters");
  return Buffer.from(env, "hex");
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
