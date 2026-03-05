/**
 * Full end-to-end integration test against a live AgentDrop deployment.
 *
 * Usage:
 *   AGENTDROP_URL=https://www.agentdrop.sh \
 *   CLERK_SECRET_KEY=sk_test_... \
 *   npx tsx packages/shared/src/scripts/e2e-test.ts
 */
import {
  generateKeyPair,
  exportPublicKey,
  hashPublicKey,
  signRequest,
  HEADER_KEY_HASH,
  HEADER_TIMESTAMP,
  HEADER_NONCE,
  HEADER_SIGNATURE,
} from "../index.js";

const BASE = process.env.AGENTDROP_URL ?? "https://www.agentdrop.sh";
const CLERK_SECRET = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET) {
  console.error("CLERK_SECRET_KEY env var required");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// --- Clerk helpers ---

async function clerkAPI(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function getOrCreateTestUser(): Promise<string> {
  // Clerk /v1/users returns a plain array
  const users = (await clerkAPI("/users?limit=1")) as { id: string }[];
  if (Array.isArray(users) && users.length > 0) {
    return users[0].id;
  }
  // Create a test user — Clerk needs email_address as array + password
  const user = (await clerkAPI("/users", "POST", {
    email_address: [`agentdrop-test-${Date.now()}@agentdrop.sh`],
    password: "AgentDropTest1234",
  })) as { id: string };
  return user.id;
}

async function getSessionToken(userId: string): Promise<string> {
  // Create a session for the user
  const session = (await clerkAPI("/sessions", "POST", {
    user_id: userId,
  })) as { id: string };

  // Get a JWT token for the session
  const tokenRes = (await clerkAPI(
    `/sessions/${session.id}/tokens`,
    "POST",
  )) as { jwt: string };

  return tokenRes.jwt;
}

// --- AgentDrop helpers ---

async function humanFetch(
  token: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const bodyStr = body ? JSON.stringify(body) : undefined;
  if (bodyStr) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: bodyStr,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json: json as Record<string, unknown> };
}

async function agentFetch(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  method: string,
  path: string,
  body?: unknown,
) {
  const keyHash = await hashPublicKey(publicKey);
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const { timestamp, nonce, signature } = await signRequest(
    privateKey,
    method,
    path,
    bodyStr,
  );

  const headers: Record<string, string> = {
    [HEADER_KEY_HASH]: keyHash,
    [HEADER_TIMESTAMP]: timestamp,
    [HEADER_NONCE]: nonce,
    [HEADER_SIGNATURE]: signature,
  };
  if (bodyStr) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: bodyStr,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json: json as Record<string, unknown> };
}

// --- Main test ---

async function main() {
  console.log(`\n🔗 Testing against ${BASE}\n`);

  // Step 1: Get Clerk session token
  console.log("Phase 1: Clerk authentication");
  const userId = await getOrCreateTestUser();
  console.log(`  User ID: ${userId}`);
  const token = await getSessionToken(userId);
  check("Got Clerk session token", !!token);

  // Step 2: Generate agent keypair
  console.log("\nPhase 2: Key registration");
  const { publicKey, privateKey } = await generateKeyPair();
  const keyHash = await hashPublicKey(publicKey);
  const pubKeyStr = await exportPublicKey(publicKey);
  console.log(`  Key hash: ${keyHash}`);

  // Step 3: Register the key via human auth
  const label = `test-${Date.now()}`;
  const createKeyRes = await humanFetch(token, "POST", "/api/keys", {
    label,
    publicKey: pubKeyStr,
  });
  check("Register agent key", createKeyRes.status === 200 || createKeyRes.status === 201, `status=${createKeyRes.status}`);

  const keyRecord = (createKeyRes.json as Record<string, unknown>).key as Record<string, unknown> | undefined;
  const keyId = keyRecord?.id as string;

  // Step 4: List keys
  const listKeysRes = await humanFetch(token, "GET", "/api/keys");
  check("List keys", listKeysRes.status === 200);
  const keys = (listKeysRes.json as Record<string, unknown>).keys as unknown[];
  check("Key appears in list", keys?.some((k: unknown) => (k as Record<string, unknown>).id === keyId));

  // Step 5: Public key lookup
  const pubkeyRes = await agentFetch(privateKey, publicKey, "GET", `/api/keys/${keyId}/pubkey`);
  check("Public key lookup", pubkeyRes.status === 200, `status=${pubkeyRes.status}`);

  // Step 6: Agent-authed file upload (two-step: POST metadata, PUT body)
  console.log("\nPhase 3: File upload (agent auth)");
  const fileContent = "Hello, world!";

  const uploadRes = await agentFetch(privateKey, publicKey, "POST", "/api/upload", {
    filename: "hello.txt",
    contentType: "text/plain",
    sizeBytes: fileContent.length,
  });
  check("Initiate upload", uploadRes.status === 201 || uploadRes.status === 200, `status=${uploadRes.status} body=${JSON.stringify(uploadRes.json)}`);

  const fileId = (uploadRes.json as Record<string, unknown>).fileId as string;

  // PUT the actual file content to /api/upload/{id}/blob
  if (fileId) {
    const blobPath = `/api/upload/${fileId}/blob`;
    const blobKeyHash = await hashPublicKey(publicKey);
    const blobSigned = await signRequest(privateKey, "PUT", blobPath);

    const blobRes = await fetch(`${BASE}${blobPath}`, {
      method: "PUT",
      headers: {
        [HEADER_KEY_HASH]: blobKeyHash,
        [HEADER_TIMESTAMP]: blobSigned.timestamp,
        [HEADER_NONCE]: blobSigned.nonce,
        [HEADER_SIGNATURE]: blobSigned.signature,
        "Content-Type": "text/plain",
      },
      body: fileContent,
    });
    const blobText = await blobRes.text();
    let blobJson: unknown;
    try { blobJson = JSON.parse(blobText); } catch { blobJson = blobText; }
    check("Upload file content", blobRes.ok, `status=${blobRes.status} body=${JSON.stringify(blobJson)}`);
  }

  // Step 7: List files
  console.log("\nPhase 4: File operations (agent auth)");
  const listFilesRes = await agentFetch(privateKey, publicKey, "GET", "/api/files");
  check("List files", listFilesRes.status === 200);
  const files = (listFilesRes.json as Record<string, unknown>).files as unknown[];
  check("File appears in list", files?.length > 0);

  // Step 8: Get file metadata
  const fileInfoRes = await agentFetch(privateKey, publicKey, "GET", `/api/files/${fileId}`);
  check("Get file metadata", fileInfoRes.status === 200);

  // Step 9: Download own file
  const downloadRes = await agentFetch(privateKey, publicKey, "GET", `/api/files/${fileId}/download`);
  check("Get download URL (owner)", downloadRes.status === 200, `status=${downloadRes.status} body=${JSON.stringify(downloadRes.json)}`);

  const downloadUrl = (downloadRes.json as Record<string, unknown>).downloadUrl as string;
  if (downloadUrl) {
    const fileRes = await fetch(downloadUrl);
    const content = await fileRes.text();
    check("Download file content matches", content === fileContent, `got "${content}"`);
  }

  // Step 10: Grant access to a second agent
  console.log("\nPhase 5: Grants");
  const { publicKey: pub2, privateKey: priv2 } = await generateKeyPair();
  const keyHash2 = await hashPublicKey(pub2);
  const pubKeyStr2 = await exportPublicKey(pub2);

  // Register second key
  const label2 = `test2-${Date.now()}`;
  const createKey2Res = await humanFetch(token, "POST", "/api/keys", {
    label: label2,
    publicKey: pubKeyStr2,
  });
  check("Register second agent key", createKey2Res.status === 200 || createKey2Res.status === 201);

  // Create grant from first agent to second
  const grantRes = await agentFetch(privateKey, publicKey, "POST", "/api/grant", {
    fileId,
    granteeKeyHash: keyHash2,
    permissions: ["download"],
    ttlSeconds: 300,
  });
  check("Create grant", grantRes.status === 200 || grantRes.status === 201, `status=${grantRes.status}`);

  const grantToken = (grantRes.json as Record<string, unknown>).token as string;
  const grantRecord = (grantRes.json as Record<string, unknown>).grant as Record<string, unknown>;
  const grantId = grantRecord?.id as string;

  // List grants for file
  const listGrantsRes = await agentFetch(privateKey, publicKey, "GET", `/api/grants/file/${fileId}`);
  check("List grants for file", listGrantsRes.status === 200);

  // Second agent lists received grants
  const receivedRes = await agentFetch(priv2, pub2, "GET", "/api/grants/received");
  check("List received grants (agent 2)", receivedRes.status === 200);

  // Second agent downloads with grant token
  // Sign only the pathname (no query string), but pass token as query param
  if (grantToken) {
    const dlPath = `/api/files/${fileId}/download`;
    const dlKeyHash = await hashPublicKey(pub2);
    const dlSigned = await signRequest(priv2, "GET", dlPath);
    const dlRes = await fetch(`${BASE}${dlPath}?token=${encodeURIComponent(grantToken)}`, {
      method: "GET",
      headers: {
        [HEADER_KEY_HASH]: dlKeyHash,
        [HEADER_TIMESTAMP]: dlSigned.timestamp,
        [HEADER_NONCE]: dlSigned.nonce,
        [HEADER_SIGNATURE]: dlSigned.signature,
      },
    });
    const dlText = await dlRes.text();
    let dlJson: unknown;
    try { dlJson = JSON.parse(dlText); } catch { dlJson = dlText; }
    const grantDownloadRes = { status: dlRes.status, json: dlJson as Record<string, unknown> };
    check("Download with grant token (agent 2)", grantDownloadRes.status === 200, `status=${grantDownloadRes.status} body=${JSON.stringify(grantDownloadRes.json)}`);

    const grantDownloadUrl = (grantDownloadRes.json as Record<string, unknown>).downloadUrl as string;
    if (grantDownloadUrl) {
      const grantFileRes = await fetch(grantDownloadUrl);
      const grantContent = await grantFileRes.text();
      check("Grant download content matches", grantContent === fileContent);
    }
  }

  // Revoke grant
  if (grantId) {
    const revokeRes = await agentFetch(privateKey, publicKey, "DELETE", `/api/grant/${grantId}`);
    check("Revoke grant", revokeRes.status === 200, `status=${revokeRes.status}`);
  }

  // Step 11: Delete file
  console.log("\nPhase 6: Cleanup");
  const deleteRes = await agentFetch(privateKey, publicKey, "DELETE", `/api/files/${fileId}`);
  check("Delete file", deleteRes.status === 200, `status=${deleteRes.status}`);

  // Verify deleted
  const deletedRes = await agentFetch(privateKey, publicKey, "GET", `/api/files/${fileId}`);
  check("Deleted file returns 404", deletedRes.status === 404, `status=${deletedRes.status}`);

  // Revoke keys
  if (keyId) {
    const revokeKeyRes = await humanFetch(token, "DELETE", `/api/keys/${keyId}`);
    check("Revoke first key", revokeKeyRes.status === 200, `status=${revokeKeyRes.status}`);
  }

  // Summary
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(40)}\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
