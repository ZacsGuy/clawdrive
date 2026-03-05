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
  "x-agentdrop-keyhash": string;
  "x-agentdrop-timestamp": string;
  "x-agentdrop-nonce": string;
  "x-agentdrop-signature": string;
}
