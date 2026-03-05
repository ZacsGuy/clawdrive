const LLMS_TXT = `# AgentDrop

> File sharing infrastructure for AI agents. Cryptographic identity, scoped grants, full audit trail.

## Install

\`\`\`sh
curl -fsSL https://agentdrop.sh/install | sh
\`\`\`

Requires Node.js >= 18.

## API Base URL

https://www.agentdrop.sh/api

## Authentication

Agents authenticate by signing every request with an Ed25519 keypair.

Required headers on every request:
- \`x-agentdrop-keyhash\`: SHA-256 thumbprint of the agent's public key
- \`x-agentdrop-timestamp\`: ISO 8601 timestamp (must be within 300s of server time)
- \`x-agentdrop-nonce\`: Unique nonce (consumed server-side to prevent replay)
- \`x-agentdrop-signature\`: Ed25519 signature over canonical string

Canonical string format:
\`\`\`
METHOD\\nPATH\\nTIMESTAMP\\nNONCE\\nBODY_HASH
\`\`\`

BODY_HASH is the hex-encoded SHA-256 of the request body (empty string if no body).

## Endpoints

### Keys

- \`POST /api/keys\` — Register a new agent key (human auth required)
  - Body: \`{ "label": string, "publicKey": string }\`
  - Returns: \`{ "key": { id, userId, label, publicKey, keyHash, createdAt } }\`

- \`GET /api/keys\` — List registered keys (human auth required)
  - Returns: \`{ "keys": AgentKeyRecord[] }\`

- \`DELETE /api/keys/:id\` — Revoke a key (human auth required)

- \`GET /api/keys/:id/pubkey\` — Get public key by ID (public endpoint)
  - Returns: \`{ "publicKey": string }\`

### Files

- \`POST /api/upload\` — Create a pending upload
  - Body: \`{ "filename": string, "contentType": string, "sizeBytes": number }\`
  - Returns: \`{ "uploadUrl": string, "fileId": string }\`

- \`PUT /api/upload/:id/blob\` — Upload file content to the returned uploadUrl

- \`POST /api/upload/confirm\` — Confirm upload with SHA-256 verification
  - Body: \`{ "fileId": string, "sha256": string }\`

- \`GET /api/files\` — List your files
  - Returns: \`{ "files": FileRecord[] }\`

- \`GET /api/files/:id\` — Get file metadata
  - Returns: FileRecord

- \`DELETE /api/files/:id\` — Soft delete a file

- \`GET /api/files/:id/download\` — Get a presigned download URL
  - Query: \`?grant=<token>\` (required if not file owner)
  - Returns: \`{ "downloadUrl": string }\`

### Grants

- \`POST /api/grant\` — Create a file access grant
  - Body: \`{ "fileId": string, "granteeKeyHash": string, "permissions": ["download"], "ttlSeconds": number }\`
  - Returns: \`{ "grant": GrantRecord, "token": string }\`

- \`DELETE /api/grant/:id\` — Revoke a grant

- \`GET /api/grants/file/:id\` — List grants for a file (owner only)
  - Returns: \`{ "grants": GrantRecord[] }\`

- \`GET /api/grants/received\` — List grants received by the authenticated agent
  - Returns: \`{ "grants": GrantRecord[] }\`

### Other

- \`GET /.well-known/jwks.json\` — Public JWKS for verifying grant JWTs

## SDK

\`\`\`typescript
import { AgentDropClient } from "@agentdrop/sdk";
import { generateKeyPair } from "@agentdrop/shared";

const { publicKey, privateKey } = await generateKeyPair();
const client = new AgentDropClient({ publicKey, privateKey });

// Upload
const file = await client.upload(buffer, "report.pdf", "application/pdf");

// Grant access to another agent for 1 hour
const { token } = await client.createGrant(
  file.id, recipientKeyHash, ["download"], 3600
);

// Download (as recipient)
const data = await recipientClient.download(file.id, token);
\`\`\`

## CLI Commands

| Command | Description |
|---|---|
| \`agentdrop keys create <label>\` | Generate Ed25519 keypair |
| \`agentdrop keys ls\` | List registered keys |
| \`agentdrop keys export <label>\` | Print public key hash |
| \`agentdrop keys revoke <id>\` | Revoke a key |
| \`agentdrop upload <file>\` | Upload a file |
| \`agentdrop download <id> [--grant <token>]\` | Download a file |
| \`agentdrop ls\` | List your files |
| \`agentdrop rm <id>\` | Delete a file |
| \`agentdrop info <id>\` | Show file details |
| \`agentdrop grant <file_id> --to <hash> --ttl <dur>\` | Create a grant |
| \`agentdrop revoke-grant <id>\` | Revoke a grant |
| \`agentdrop grants <file_id>\` | List grants for a file |
| \`agentdrop config set <key> <value>\` | Set config |

## Source

- GitHub: https://github.com/djgould/agentdrop
- Landing page: https://agentdrop.sh
`;

export async function GET() {
  return new Response(LLMS_TXT, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
