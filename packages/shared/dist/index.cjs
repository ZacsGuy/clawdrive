"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  DEFAULT_API_BASE_URL: () => DEFAULT_API_BASE_URL,
  GRANT_DEFAULT_TTL_SECONDS: () => GRANT_DEFAULT_TTL_SECONDS,
  GRANT_ISSUER: () => GRANT_ISSUER,
  HEADER_KEY_HASH: () => HEADER_KEY_HASH,
  HEADER_NONCE: () => HEADER_NONCE,
  HEADER_SIGNATURE: () => HEADER_SIGNATURE,
  HEADER_TIMESTAMP: () => HEADER_TIMESTAMP,
  TIMESTAMP_TOLERANCE_SECONDS: () => TIMESTAMP_TOLERANCE_SECONDS,
  agentKeys: () => agentKeys,
  auditLog: () => auditLog,
  buildCanonicalString: () => buildCanonicalString,
  createGrantJWT: () => createGrantJWT,
  createGrantSchema: () => createGrantSchema,
  createKeySchema: () => createKeySchema,
  exportJWKS: () => exportJWKS,
  exportPrivateKey: () => exportPrivateKey,
  exportPublicKey: () => exportPublicKey,
  files: () => files,
  generateKeyPair: () => generateKeyPair2,
  grants: () => grants,
  hashBody: () => hashBody,
  hashPublicKey: () => hashPublicKey,
  importPrivateKey: () => importPrivateKey,
  importPublicKey: () => importPublicKey,
  isTimestampValid: () => isTimestampValid,
  nonces: () => nonces,
  signRequest: () => signRequest,
  uploadConfirmSchema: () => uploadConfirmSchema,
  uploadRequestSchema: () => uploadRequestSchema,
  verifyGrantJWT: () => verifyGrantJWT,
  verifySignature: () => verifySignature
});
module.exports = __toCommonJS(index_exports);

// src/constants.ts
var TIMESTAMP_TOLERANCE_SECONDS = 300;
var DEFAULT_API_BASE_URL = "https://api.clawdrive.dev";
var HEADER_KEY_HASH = "x-clawdrive-keyhash";
var HEADER_TIMESTAMP = "x-clawdrive-timestamp";
var HEADER_NONCE = "x-clawdrive-nonce";
var HEADER_SIGNATURE = "x-clawdrive-signature";
var GRANT_ISSUER = "clawdrive";
var GRANT_DEFAULT_TTL_SECONDS = 300;

// src/validation.ts
var import_zod = require("zod");
var uploadRequestSchema = import_zod.z.object({
  filename: import_zod.z.string().min(1).max(255),
  contentType: import_zod.z.string().min(1).max(255),
  sizeBytes: import_zod.z.number().int().positive().max(100 * 1024 * 1024)
  // 100MB
});
var uploadConfirmSchema = import_zod.z.object({
  fileId: import_zod.z.string().uuid(),
  sha256: import_zod.z.string().regex(/^[a-f0-9]{64}$/)
});
var createGrantSchema = import_zod.z.object({
  fileId: import_zod.z.string().uuid(),
  granteeKeyHash: import_zod.z.string().min(1),
  permissions: import_zod.z.array(import_zod.z.enum(["download"])).min(1),
  ttlSeconds: import_zod.z.number().int().positive().max(86400)
  // max 24h
});
var createKeySchema = import_zod.z.object({
  label: import_zod.z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  publicKey: import_zod.z.string().min(1)
});

// src/schema.ts
var import_pg_core = require("drizzle-orm/pg-core");
var agentKeys = (0, import_pg_core.pgTable)(
  "agent_keys",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.text)("user_id").notNull(),
    label: (0, import_pg_core.text)("label").notNull(),
    publicKey: (0, import_pg_core.text)("public_key").notNull(),
    keyHash: (0, import_pg_core.text)("key_hash").notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: (0, import_pg_core.timestamp)("revoked_at", { withTimezone: true })
  },
  (table) => [(0, import_pg_core.uniqueIndex)("agent_keys_key_hash_idx").on(table.keyHash)]
);
var files = (0, import_pg_core.pgTable)("files", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  ownerId: (0, import_pg_core.text)("owner_id").notNull(),
  ownerType: (0, import_pg_core.text)("owner_type").notNull().$type(),
  filename: (0, import_pg_core.text)("filename").notNull(),
  contentType: (0, import_pg_core.text)("content_type").notNull(),
  sizeBytes: (0, import_pg_core.integer)("size_bytes").notNull(),
  blobUrl: (0, import_pg_core.text)("blob_url"),
  sha256: (0, import_pg_core.text)("sha256"),
  confirmed: (0, import_pg_core.text)("confirmed").notNull().$type().default("pending"),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: (0, import_pg_core.timestamp)("deleted_at", { withTimezone: true })
});
var grants = (0, import_pg_core.pgTable)("grants", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  fileId: (0, import_pg_core.uuid)("file_id").notNull().references(() => files.id),
  grantorId: (0, import_pg_core.text)("grantor_id").notNull(),
  grantorType: (0, import_pg_core.text)("grantor_type").notNull().$type(),
  granteeKeyHash: (0, import_pg_core.text)("grantee_key_hash").notNull(),
  permissions: (0, import_pg_core.jsonb)("permissions").notNull().$type(),
  expiresAt: (0, import_pg_core.timestamp)("expires_at", { withTimezone: true }).notNull(),
  revokedAt: (0, import_pg_core.timestamp)("revoked_at", { withTimezone: true }),
  createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow()
});
var nonces = (0, import_pg_core.pgTable)(
  "nonces",
  {
    nonce: (0, import_pg_core.text)("nonce").primaryKey(),
    keyHash: (0, import_pg_core.text)("key_hash").notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: (0, import_pg_core.timestamp)("expires_at", { withTimezone: true }).notNull()
  }
);
var auditLog = (0, import_pg_core.pgTable)("audit_log", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  keyId: (0, import_pg_core.uuid)("key_id").references(() => agentKeys.id),
  userId: (0, import_pg_core.text)("user_id"),
  action: (0, import_pg_core.text)("action").notNull(),
  resourceType: (0, import_pg_core.text)("resource_type").notNull(),
  resourceId: (0, import_pg_core.text)("resource_id").notNull(),
  timestamp: (0, import_pg_core.timestamp)("timestamp", { withTimezone: true }).notNull().defaultNow(),
  metadata: (0, import_pg_core.jsonb)("metadata").$type()
});

// src/crypto/keys.ts
var jose = __toESM(require("jose"), 1);
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
var import_jose = require("jose");
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
  const signature = await new import_jose.CompactSign(encoder.encode(canonical)).setProtectedHeader({ alg: "EdDSA" }).sign(privateKey);
  return { timestamp: timestamp2, nonce, signature, bodyHash };
}

// src/crypto/verify.ts
var import_jose2 = require("jose");
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
    const result = await (0, import_jose2.compactVerify)(signature, publicKey);
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
var import_jose3 = require("jose");
async function createGrantJWT(signingKey, payload) {
  return new import_jose3.SignJWT({ permissions: payload.permissions }).setProtectedHeader({ alg: "EdDSA" }).setIssuer(GRANT_ISSUER).setSubject(payload.fileId).setAudience(payload.granteeKeyHash).setJti(payload.grantId).setIssuedAt().setExpirationTime(`${payload.ttlSeconds}s`).sign(signingKey);
}
async function verifyGrantJWT(publicKey, token) {
  const { payload } = await (0, import_jose3.jwtVerify)(token, publicKey, {
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
  const jwk = await (0, import_jose3.exportJWK)(publicKey);
  jwk.kid = "clawdrive-signing-key-1";
  jwk.use = "sig";
  jwk.alg = "EdDSA";
  return { keys: [jwk] };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
  generateKeyPair,
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
});
//# sourceMappingURL=index.cjs.map