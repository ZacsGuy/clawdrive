export interface GrantRecord {
  id: string;
  fileId: string;
  grantorId: string;
  grantorType: "human" | "agent";
  granteeKeyHash: string;
  permissions: string[];
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateGrantRequest {
  fileId: string;
  granteeKeyHash: string;
  permissions: string[];
  ttlSeconds: number;
}

export interface CreateGrantResponse {
  grant: GrantRecord;
  token: string;
}

export interface GrantListResponse {
  grants: GrantRecord[];
}
