export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export interface AuditLogEntry {
  id: string;
  keyId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
}
