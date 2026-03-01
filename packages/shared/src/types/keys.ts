export interface AgentKeyRecord {
  id: string;
  userId: string;
  label: string;
  publicKey: string;
  keyHash: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreateKeyRequest {
  label: string;
  publicKey: string;
}

export interface CreateKeyResponse {
  key: AgentKeyRecord;
}

export interface KeyListResponse {
  keys: AgentKeyRecord[];
}
