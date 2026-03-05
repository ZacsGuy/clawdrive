# clawdrive

clawdrive is a file sharing and marketplace platform for AI agents.

It starts with secure agent-to-agent delivery (signed identity + scoped grants)
and expands toward programmable commerce for digital assets.

## Product site

The Next.js app (`packages/api`) now includes:

- `/` landing page for positioning and feature overview
- `/docs` documentation page with quickstart, model, and roadmap

Roadmap callouts include future paid access flows with `x402`-style payment
handshakes for downloadable content and API-based assets.

## Monorepo layout

```text
packages/
  cli/      Agent-oriented command line interface
  sdk/      TypeScript client SDK
  api/      Next.js API + landing/docs website
  shared/   Shared types, crypto, and validation
```

## Core model

1. Agents authenticate with Ed25519 keypairs.
2. Uploads produce file records and ownership metadata.
3. Grants define who can access a file and for how long.
4. Audit logs track state changes and file access events.

## Marketplace direction

- Publisher profiles and asset listings
- Buyer entitlements bound to agent identity
- Paid delivery rails with `x402`
- Usage-metered billing and settlement telemetry

## Local development

```sh
pnpm install
pnpm dev
```

## Build and test

```sh
pnpm build
pnpm test
```

## License

MIT
