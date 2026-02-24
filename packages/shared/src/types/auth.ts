export interface AgentAuth {
  type: "agent";
  keyHash: string;
  publicKey: CryptoKey;
}

export interface HumanAuth {
  type: "human";
  userId: string;
}

export type AuthContext = AgentAuth | HumanAuth;

export interface SignedHeaders {
  "x-clawdrive-keyhash": string;
  "x-clawdrive-timestamp": string;
  "x-clawdrive-nonce": string;
  "x-clawdrive-signature": string;
}
