import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  hashPublicKey,
  signRequest,
  verifySignature,
  isTimestampValid,
  createGrantJWT,
  verifyGrantJWT,
} from "../index.js";

describe("key generation and serialization", () => {
  it("generates a keypair and round-trips through export/import", async () => {
    const { publicKey, privateKey } = await generateKeyPair();

    const pubStr = await exportPublicKey(publicKey);
    const privStr = await exportPrivateKey(privateKey);

    const importedPub = await importPublicKey(pubStr);
    const importedPriv = await importPrivateKey(privStr);

    expect(importedPub).toBeDefined();
    expect(importedPriv).toBeDefined();

    const hash1 = await hashPublicKey(publicKey);
    const hash2 = await hashPublicKey(importedPub);
    expect(hash1).toBe(hash2);
  });

  it("produces a stable key hash", async () => {
    const { publicKey } = await generateKeyPair();
    const hash = await hashPublicKey(publicKey);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe("request signing and verification", () => {
  it("signs and verifies a request", async () => {
    const { publicKey, privateKey } = await generateKeyPair();

    const { timestamp, nonce, signature } = await signRequest(
      privateKey,
      "POST",
      "/api/upload",
      '{"filename":"test.txt"}',
    );

    const valid = await verifySignature(
      publicKey,
      signature,
      "POST",
      "/api/upload",
      timestamp,
      nonce,
      '{"filename":"test.txt"}',
    );
    expect(valid).toBe(true);
  });

  it("rejects a signature with wrong body", async () => {
    const { publicKey, privateKey } = await generateKeyPair();

    const { timestamp, nonce, signature } = await signRequest(
      privateKey,
      "POST",
      "/api/upload",
      '{"filename":"test.txt"}',
    );

    const valid = await verifySignature(
      publicKey,
      signature,
      "POST",
      "/api/upload",
      timestamp,
      nonce,
      '{"filename":"wrong.txt"}',
    );
    expect(valid).toBe(false);
  });

  it("rejects a signature from a different key", async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();

    const { timestamp, nonce, signature } = await signRequest(
      kp1.privateKey,
      "GET",
      "/api/files",
    );

    const valid = await verifySignature(
      kp2.publicKey,
      signature,
      "GET",
      "/api/files",
      timestamp,
      nonce,
    );
    expect(valid).toBe(false);
  });
});

describe("timestamp validation", () => {
  it("accepts a current timestamp", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    expect(isTimestampValid(ts)).toBe(true);
  });

  it("rejects an old timestamp", () => {
    const ts = (Math.floor(Date.now() / 1000) - 600).toString();
    expect(isTimestampValid(ts)).toBe(false);
  });
});

describe("grant JWT", () => {
  it("creates and verifies a grant JWT", async () => {
    const { publicKey, privateKey } = await generateKeyPair();

    const token = await createGrantJWT(privateKey, {
      fileId: "550e8400-e29b-41d4-a716-446655440000",
      granteeKeyHash: "test-hash",
      grantId: "660e8400-e29b-41d4-a716-446655440000",
      permissions: ["download"],
      ttlSeconds: 300,
    });

    const result = await verifyGrantJWT(publicKey, token);
    expect(result.fileId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.granteeKeyHash).toBe("test-hash");
    expect(result.grantId).toBe("660e8400-e29b-41d4-a716-446655440000");
    expect(result.permissions).toEqual(["download"]);
  });
});
