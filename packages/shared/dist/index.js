// src/constants.ts
var TIMESTAMP_TOLERANCE_SECONDS = 300;
var DEFAULT_API_BASE_URL = "https://api.agentdrop.dev";
var HEADER_KEY_HASH = "x-agentdrop-keyhash";
var HEADER_TIMESTAMP = "x-agentdrop-timestamp";
var HEADER_NONCE = "x-agentdrop-nonce";
var HEADER_SIGNATURE = "x-agentdrop-signature";
var GRANT_ISSUER = "agentdrop";
var GRANT_DEFAULT_TTL_SECONDS = 300;

// src/validation.ts
import { z } from "zod";
var uploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024)
  // 100MB
});
var uploadConfirmSchema = z.object({
  fileId: z.string().uuid(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/)
});
var createGrantSchema = z.object({
  fileId: z.string().uuid(),
  granteeKeyHash: z.string().min(1),
  permissions: z.array(z.enum(["download"])).min(1),
  ttlSeconds: z.number().int().positive().max(86400)
  // max 24h
});
var createKeySchema = z.object({
  label: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  publicKey: z.string().min(1)
});

// src/schema.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex
} from "drizzle-orm/pg-core";
var agentKeys = pgTable(
  "agent_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    label: text("label").notNull(),
    publicKey: text("public_key").notNull(),
    keyHash: text("key_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => [uniqueIndex("agent_keys_key_hash_idx").on(table.keyHash)]
);
var files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  ownerType: text("owner_type").notNull().$type(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  blobUrl: text("blob_url"),
  sha256: text("sha256"),
  confirmed: text("confirmed").notNull().$type().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});
var grants = pgTable("grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull().references(() => files.id),
  grantorId: text("grantor_id").notNull(),
  grantorType: text("grantor_type").notNull().$type(),
  granteeKeyHash: text("grantee_key_hash").notNull(),
  permissions: jsonb("permissions").notNull().$type(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var nonces = pgTable(
  "nonces",
  {
    nonce: text("nonce").primaryKey(),
    keyHash: text("key_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  }
);
var auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyId: uuid("key_id").references(() => agentKeys.id),
  userId: text("user_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").$type()
});

// src/crypto/keys.ts
import * as jose from "jose";
async function generateKeyPair2() {
  const { publicKey, privateKey } = await jose.generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true
  });
  return { publicKey, privateKey };
}
async function exportPublicKey(key) {
  const jwk = await jose.exportJWK(key);
  return JSON.stringify(jwk);
}
async function exportPrivateKey(key) {
  const jwk = await jose.exportJWK(key);
  return JSON.stringify(jwk);
}
async function importPublicKey(jwkString) {
  const jwk = JSON.parse(jwkString);
  return await jose.importJWK(jwk, "EdDSA");
}
async function importPrivateKey(jwkString) {
  const jwk = JSON.parse(jwkString);
  return await jose.importJWK(jwk, "EdDSA");
}
async function hashPublicKey(publicKey) {
  const jwk = await jose.exportJWK(publicKey);
  const thumbprint = await jose.calculateJwkThumbprint(jwk, "sha256");
  return thumbprint;
}

// src/crypto/sign.ts
import { CompactSign } from "jose";
function buildCanonicalString(method, path, timestamp2, nonce, bodyHash) {
  return `${method}
${path}
${timestamp2}
${nonce}
${bodyHash}`;
}
async function hashBody(body) {
  const data = new TextEncoder().encode(body ?? "");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function signRequest(privateKey, method, path, body) {
  const timestamp2 = Math.floor(Date.now() / 1e3).toString();
  const nonce = crypto.randomUUID();
  const bodyHash = await hashBody(body);
  const canonical = buildCanonicalString(
    method,
    path,
    timestamp2,
    nonce,
    bodyHash
  );
  const encoder = new TextEncoder();
  const signature = await new CompactSign(encoder.encode(canonical)).setProtectedHeader({ alg: "EdDSA" }).sign(privateKey);
  return { timestamp: timestamp2, nonce, signature, bodyHash };
}

// src/crypto/verify.ts
import { compactVerify } from "jose";
async function verifySignature(publicKey, signature, method, path, timestamp2, nonce, body) {
  try {
    const bodyHash = await hashBody(body);
    const canonical = buildCanonicalString(
      method,
      path,
      timestamp2,
      nonce,
      bodyHash
    );
    const result = await compactVerify(signature, publicKey);
    const decoded = new TextDecoder().decode(result.payload);
    return decoded === canonical;
  } catch {
    return false;
  }
}
function isTimestampValid(timestamp2, toleranceSeconds = TIMESTAMP_TOLERANCE_SECONDS) {
  const ts = parseInt(timestamp2, 10);
  if (isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1e3);
  return Math.abs(now - ts) <= toleranceSeconds;
}

// src/crypto/jwt.ts
import { SignJWT, jwtVerify, exportJWK as exportJWK2 } from "jose";
async function createGrantJWT(signingKey, payload) {
  return new SignJWT({ permissions: payload.permissions }).setProtectedHeader({ alg: "EdDSA" }).setIssuer(GRANT_ISSUER).setSubject(payload.fileId).setAudience(payload.granteeKeyHash).setJti(payload.grantId).setIssuedAt().setExpirationTime(`${payload.ttlSeconds}s`).sign(signingKey);
}
async function verifyGrantJWT(publicKey, token) {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: GRANT_ISSUER
  });
  return {
    fileId: payload.sub,
    granteeKeyHash: Array.isArray(payload.aud) ? payload.aud[0] : payload.aud,
    grantId: payload.jti,
    permissions: payload.permissions
  };
}
async function exportJWKS(publicKey) {
  const jwk = await exportJWK2(publicKey);
  jwk.kid = "agentdrop-signing-key-1";
  jwk.use = "sig";
  jwk.alg = "EdDSA";
  return { keys: [jwk] };
}
export {
  DEFAULT_API_BASE_URL,
  GRANT_DEFAULT_TTL_SECONDS,
  GRANT_ISSUER,
  HEADER_KEY_HASH,
  HEADER_NONCE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  TIMESTAMP_TOLERANCE_SECONDS,
  agentKeys,
  auditLog,
  buildCanonicalString,
  createGrantJWT,
  createGrantSchema,
  createKeySchema,
  exportJWKS,
  exportPrivateKey,
  exportPublicKey,
  files,
  generateKeyPair2 as generateKeyPair,
  grants,
  hashBody,
  hashPublicKey,
  importPrivateKey,
  importPublicKey,
  isTimestampValid,
  nonces,
  signRequest,
  uploadConfirmSchema,
  uploadRequestSchema,
  verifyGrantJWT,
  verifySignature
};
//# sourceMappingURL=index.js.map