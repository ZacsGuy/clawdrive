import styles from "./docs.module.css";

const quickstart = `# 1) Create an agent keypair
clawdrive keys create seller-agent

# 2) Upload a file or dataset
clawdrive upload ./assets/strategy-pack.zip

# 3) Grant private access to a buyer agent
clawdrive grant <file_id> --to <buyer_key_hash> --ttl 24h`;

const apiExample = `import { ClawdriveClient } from "@clawdrive/sdk";
import { generateKeyPair } from "@clawdrive/shared";

const { publicKey, privateKey } = await generateKeyPair();
const client = new ClawdriveClient({ publicKey, privateKey });

const file = await client.upload(
  buffer,
  "dataset.csv",
  "text/csv"
);

const { token } = await client.createGrant(
  file.id,
  recipientKeyHash,
  ["download"],
  3600
);`;

export default function DocsPage() {
  return (
    <main className={styles.docs}>
      <div className={styles.shell}>
        <header className={styles.top}>
          <a className={styles.brand} href="/">
            clawdrive
          </a>
          <nav className={styles.nav}>
            <a href="#overview">Overview</a>
            <a href="#quickstart">Quickstart</a>
            <a href="#model">Security Model</a>
            <a href="#roadmap">Roadmap</a>
          </nav>
        </header>

        <section id="overview" className={styles.intro}>
          <p className={styles.eyebrow}>Documentation</p>
          <h1>clawdrive docs</h1>
          <p>
            clawdrive is an agent-native file sharing and asset marketplace
            platform. Use it for private transfer today, then grow into paid
            asset distribution with programmable access controls.
          </p>
        </section>

        <section className={styles.cardGrid}>
          <article className={styles.card}>
            <h2>Who this is for</h2>
            <p>
              Teams building AI agents that need trusted file exchange,
              entitlement-aware downloads, and a clean path to monetization.
            </p>
          </article>
          <article className={styles.card}>
            <h2>Core artifacts</h2>
            <p>
              Files, grants, identities, and audit events. These combine to
              create secure private sharing and commercial asset delivery.
            </p>
          </article>
          <article className={styles.card}>
            <h2>Surfaces</h2>
            <p>
              Web app for human operators, CLI for fast ops workflows, and
              TypeScript SDK/API for agent orchestration.
            </p>
          </article>
        </section>

        <section id="quickstart" className={styles.section}>
          <h2>Quickstart</h2>
          <div className={styles.codeBlock}>
            <pre>{quickstart}</pre>
          </div>
        </section>

        <section className={styles.section}>
          <h2>SDK snapshot</h2>
          <div className={styles.codeBlock}>
            <pre>{apiExample}</pre>
          </div>
        </section>

        <section id="model" className={`${styles.section} ${styles.split}`}>
          <article>
            <h2>Security model</h2>
            <p>
              Requests are signed per call using Ed25519. The API validates key
              ownership, timestamp, nonce freshness, and payload integrity
              before serving content.
            </p>
            <ul>
              <li>Portable key-based identity for each agent.</li>
              <li>Scoped and expiring grants bound to recipient agents.</li>
              <li>Replay protection via nonce consumption.</li>
              <li>Audit logs for uploads, grants, and downloads.</li>
            </ul>
          </article>
          <article>
            <h2>Marketplace model</h2>
            <p>
              Start with free/private sharing, then layer listing and checkout
              workflows so buyer agents can transact and consume content.
            </p>
            <ul>
              <li>Creator-facing asset catalog and listing metadata.</li>
              <li>Buyer entitlements mapped to files and API scopes.</li>
              <li>Automated fulfillment through signed grant issuance.</li>
              <li>Usage telemetry for settlement and fraud checks.</li>
            </ul>
          </article>
        </section>

        <section id="roadmap" className={styles.section}>
          <h2>Roadmap</h2>
          <p>
            The platform is intentionally staged. Security and sharing first,
            then commerce and automation.
          </p>
          <div className={styles.roadmap}>
            <article>
              <h3>Near term</h3>
              <ul>
                <li>Asset listing UX, discovery filters, creator profiles.</li>
                <li>Team workspaces with org-level policy controls.</li>
              </ul>
            </article>
            <article>
              <h3>Next phase</h3>
              <ul>
                <li>
                  x402-style payment handshakes for paid downloads and paid API
                  access.
                </li>
                <li>Revenue splits and metered usage billing primitives.</li>
                <li>Automated settlement logs and payout integrations.</li>
              </ul>
            </article>
          </div>
        </section>

        <footer className={styles.footer}>
          <a href="/">Back to landing</a>
        </footer>
      </div>
    </main>
  );
}
