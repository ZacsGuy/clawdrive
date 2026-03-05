<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=220&text=clawdrive&fontAlign=50&fontAlignY=38&desc=Agent-native%20file%20delivery%20and%20programmable%20asset%20access&descAlign=50&descAlignY=58&color=0:0b1220,100:2563eb&fontColor=ffffff" alt="clawdrive banner" />
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/status-active%20development-0ea5e9" alt="status" /></a>
  <a href="#"><img src="https://img.shields.io/badge/monorepo-turborepo-f97316" alt="monorepo" /></a>
  <a href="#"><img src="https://img.shields.io/badge/runtime-node.js-22-22c55e" alt="node" /></a>
  <a href="#"><img src="https://img.shields.io/badge/framework-next.js%2015-111827" alt="nextjs" /></a>
  <a href="#"><img src="https://img.shields.io/badge/language-typescript-2563eb" alt="typescript" /></a>
  <img src="https://img.shields.io/badge/license-MIT-a855f7" alt="license" />
</p>

<h3 align="center">Secure file exchange for AI agents now. Marketplace-grade entitlement rails next.</h3>

---

## Overview

`clawdrive` is an agent-native platform for secure file sharing and controlled digital asset delivery.

- Signed, key-based agent identity (Ed25519)
- Scoped, expiring grants for recipient-specific access
- Audit-friendly events around uploads, grants, and downloads
- Clear path from private transfer to paid access flows (`x402`-style roadmap)

## Why This Repo Exists

Most AI workflows still pass files through human-first infrastructure.
clawdrive is designed for autonomous systems that need cryptographic identity, machine-verifiable authorization, and programmable distribution.

## Product Surfaces

| Surface | Location | Purpose |
| --- | --- | --- |
| Web app + API | `packages/api` | Next.js app with landing/docs and backend API routes |
| CLI | `packages/cli` | Ops-first workflows for key management, uploads, files, and grants |
| SDK | `packages/sdk` | TypeScript client for programmatic integration |
| Shared core | `packages/shared` | Common types, crypto helpers, schema, and validation |

## Architecture Snapshot

```mermaid
flowchart LR
    A[Agent A] -->|Signed upload request| API[clawdrive API]
    API --> DB[(Metadata + Grants + Audit)]
    API --> BLOB[(Blob Storage)]
    A -->|Create scoped grant| API
    C[Agent B] -->|Download with grant token| API
    API -->|Authorize + audit| C
```

## Quickstart

```sh
pnpm install
pnpm dev
```

Key workspace commands:

```sh
pnpm build
pnpm test
pnpm typecheck
```

## Monorepo Layout

```text
packages/
  api/      Next.js API + landing/docs website
  cli/      Command-line interface for agent operators
  sdk/      TypeScript SDK for agent/application integration
  shared/   Shared crypto, schema, types, and utilities
```

## Security Model

1. Agents authenticate with Ed25519 keypairs.
2. Requests are signed and validated for integrity.
3. Grants bind access scope + expiry to recipients.
4. Nonce/timestamp checks reduce replay risk.
5. Audit logs capture critical access lifecycle events.

## Roadmap Direction

- Asset listing and publisher profile workflows
- Buyer entitlements mapped to files and scopes
- `x402`-style payment handshakes for paid delivery
- Metered usage telemetry and settlement primitives

## Development Notes

- Package scope names in this monorepo are currently `@clawdrive/*`.
- Product naming in docs/UI is currently `clawdrive`.
- A naming unification pass can be done once branding is finalized.

## License

MIT
