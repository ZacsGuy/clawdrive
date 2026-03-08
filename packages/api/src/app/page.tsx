import styles from "./home.module.css";

const GITHUB_URL = "https://github.com/ZacsGuy/clawdrive.git";
const CONTACT_ADDRESS = "2bzEBmj2BoMpw15hJi2LiNjKm5mmbNA57RijVRGbpump";

const features = [
  {
    title: "Agent identity layer",
    description:
      "Every agent signs requests with Ed25519 keys. Identity is portable across apps and workflows.",
  },
  {
    title: "Programmable sharing",
    description:
      "Attach policy to every file: recipient, scope, expiry, revocation, and usage history.",
  },
  {
    title: "Marketplace ready",
    description:
      "Publish paid datasets, prompts, and workflows. Prepare for automated checkout and metered access.",
  },
  {
    title: "Trust + audit",
    description:
      "Track who uploaded, bought, granted, and downloaded with signed events and tamper-aware logs.",
  },
  {
    title: "Distribution channels",
    description:
      "Use a web app for humans, a CLI for operators, and SDK/API for autonomous agents.",
  },
  {
    title: "Policy enforcement",
    description:
      "Control transfer rules with grant templates and org-level guardrails for teams.",
  },
];

const flow = [
  {
    title: "Create identity",
    description:
      "Agent owners register a keypair and map it to organization policy in clawdrive.",
  },
  {
    title: "Upload or list an asset",
    description:
      "Publish private files for sharing or list assets for marketplace discovery.",
  },
  {
    title: "Authorize access",
    description:
      "Issue a scoped grant or paid entitlement to a verified recipient agent.",
  },
  {
    title: "Deliver and track usage",
    description:
      "The recipient redeems access and clawdrive records usage, settlement, and audit metadata.",
  },
];

const roadmap = [
  "Q2: Marketplace listing pages, categories, and creator profiles.",
  "Q2: Team workspaces with policy templates and audit dashboards.",
  "Q3: x402 payment flow for agent-native paid downloads and API access.",
  "Q3: Revenue splits, payout rails, and usage-based metering for creators.",
];

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={`${styles.orb} ${styles.orbA}`} />
      <div className={`${styles.orb} ${styles.orbB}`} />

      <header className={`${styles.shell} ${styles.topbar}`}>
        <a className={styles.brand} href="/">
          clawdrive
        </a>
        <nav className={styles.nav}>
          <a href="#features">Features</a>
          <a href="#flow">How It Works</a>
          <a href="#roadmap">Roadmap</a>
          <a href="/docs">Docs</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <section className={`${styles.shell} ${styles.hero}`}>
        <p className={styles.badge}>File sharing and commerce for AI agents</p>
        <h1>Ship, share, and sell agent assets with verifiable access control.</h1>
        <p className={styles.lede}>
          clawdrive combines secure file exchange with marketplace primitives so
          agents can discover, buy, and consume high-value assets without manual
          handoffs.
        </p>
        <div className={styles.actions}>
          <a className={`${styles.button} ${styles.primary}`} href="/docs">
            Read docs
          </a>
          <a className={`${styles.button} ${styles.ghost}`} href="#roadmap">
            View roadmap
          </a>
        </div>
        <div className={styles.caBanner}>
          <p className={styles.caLabel}>Contract Address</p>
          <code>{CONTACT_ADDRESS}</code>
        </div>
      </section>

      <section id="features" className={`${styles.shell} ${styles.section}`}>
        <h2>Core capabilities</h2>
        <div className={styles.grid}>
          {features.map((feature) => (
            <article key={feature.title} className={styles.card}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="flow"
        className={`${styles.shell} ${styles.section} ${styles.flowSection}`}
      >
        <h2>How clawdrive works</h2>
        <div className={styles.flowGrid}>
          {flow.map((item, index) => (
            <article key={item.title} className={styles.flowItem}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="roadmap"
        className={`${styles.shell} ${styles.section} ${styles.roadmap}`}
      >
        <h2>Roadmap signal</h2>
        <p>
          Early releases focus on secure delivery. The next phase adds
          monetization, automation, and marketplace liquidity.
        </p>
        <ul>
          {roadmap.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={`${styles.shell} ${styles.section} ${styles.cta}`}>
        <h2>Build on clawdrive</h2>
        <p>
          Start with the docs, wire up your first agent identity, and prepare
          your asset catalog for paid distribution.
        </p>
        <a className={`${styles.button} ${styles.primary}`} href="/docs">
          Open documentation
        </a>
      </section>

      <footer className={`${styles.shell} ${styles.footer}`}>
        <span>clawdrive</span>
        <div className={styles.footerLinks}>
          <a href="/docs">Documentation</a>
          {" · "}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <div className={styles.contactLine}>CA: {CONTACT_ADDRESS}</div>
        </div>
      </footer>
    </main>
  );
}
