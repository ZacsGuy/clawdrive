import { z } from 'zod';
import * as drizzle_orm_pg_core from 'drizzle-orm/pg-core';

interface ApiError {
    error: string;
    code: string;
    details?: unknown;
}
interface AuditLogEntry {
    id: string;
    keyId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
interface AuditLogResponse {
    entries: AuditLogEntry[];
}

interface AgentAuth {
    type: "agent";
    keyHash: string;
    publicKey: CryptoKey;
}
interface HumanAuth {
    type: "human";
    userId: string;
}
type AuthContext = AgentAuth | HumanAuth;
interface SignedHeaders {
    "x-agentdrop-keyhash": string;
    "x-agentdrop-timestamp": string;
    "x-agentdrop-nonce": string;
    "x-agentdrop-signature": string;
}

interface FileRecord {
    id: string;
    ownerId: string;
    ownerType: "human" | "agent";
    filename: string;
    contentType: string;
    sizeBytes: number;
    blobUrl: string;
    sha256: string;
    createdAt: string;
    deletedAt: string | null;
}
interface UploadRequest {
    filename: string;
    contentType: string;
    sizeBytes: number;
}
interface UploadResponse {
    uploadUrl: string;
    fileId: string;
}
interface UploadConfirmRequest {
    fileId: string;
    sha256: string;
}
interface FileListResponse {
    files: FileRecord[];
}
interface FileDownloadResponse {
    downloadUrl: string;
}

interface GrantRecord {
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
interface CreateGrantRequest {
    fileId: string;
    granteeKeyHash: string;
    permissions: string[];
    ttlSeconds: number;
}
interface CreateGrantResponse {
    grant: GrantRecord;
    token: string;
}
interface GrantListResponse {
    grants: GrantRecord[];
}

interface AgentKeyRecord {
    id: string;
    userId: string;
    label: string;
    publicKey: string;
    keyHash: string;
    createdAt: string;
    revokedAt: string | null;
}
interface CreateKeyRequest {
    label: string;
    publicKey: string;
}
interface CreateKeyResponse {
    key: AgentKeyRecord;
}
interface KeyListResponse {
    keys: AgentKeyRecord[];
}

declare const TIMESTAMP_TOLERANCE_SECONDS = 300;
declare const DEFAULT_API_BASE_URL = "https://api.agentdrop.dev";
declare const HEADER_KEY_HASH = "x-agentdrop-keyhash";
declare const HEADER_TIMESTAMP = "x-agentdrop-timestamp";
declare const HEADER_NONCE = "x-agentdrop-nonce";
declare const HEADER_SIGNATURE = "x-agentdrop-signature";
declare const GRANT_ISSUER = "agentdrop";
declare const GRANT_DEFAULT_TTL_SECONDS = 300;

declare const uploadRequestSchema: z.ZodObject<{
    filename: z.ZodString;
    contentType: z.ZodString;
    sizeBytes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    filename: string;
    contentType: string;
    sizeBytes: number;
}, {
    filename: string;
    contentType: string;
    sizeBytes: number;
}>;
declare const uploadConfirmSchema: z.ZodObject<{
    fileId: z.ZodString;
    sha256: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fileId: string;
    sha256: string;
}, {
    fileId: string;
    sha256: string;
}>;
declare const createGrantSchema: z.ZodObject<{
    fileId: z.ZodString;
    granteeKeyHash: z.ZodString;
    permissions: z.ZodArray<z.ZodEnum<["download"]>, "many">;
    ttlSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    fileId: string;
    granteeKeyHash: string;
    permissions: "download"[];
    ttlSeconds: number;
}, {
    fileId: string;
    granteeKeyHash: string;
    permissions: "download"[];
    ttlSeconds: number;
}>;
declare const createKeySchema: z.ZodObject<{
    label: z.ZodString;
    publicKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    label: string;
    publicKey: string;
}, {
    label: string;
    publicKey: string;
}>;

declare const agentKeys: drizzle_orm_pg_core.PgTableWithColumns<{
    name: "agent_keys";
    schema: undefined;
    columns: {
        id: drizzle_orm_pg_core.PgColumn<{
            name: "id";
            tableName: "agent_keys";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        userId: drizzle_orm_pg_core.PgColumn<{
            name: "user_id";
            tableName: "agent_keys";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        label: drizzle_orm_pg_core.PgColumn<{
            name: "label";
            tableName: "agent_keys";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        publicKey: drizzle_orm_pg_core.PgColumn<{
            name: "public_key";
            tableName: "agent_keys";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        keyHash: drizzle_orm_pg_core.PgColumn<{
            name: "key_hash";
            tableName: "agent_keys";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: drizzle_orm_pg_core.PgColumn<{
            name: "created_at";
            tableName: "agent_keys";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        revokedAt: drizzle_orm_pg_core.PgColumn<{
            name: "revoked_at";
            tableName: "agent_keys";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
declare const files: drizzle_orm_pg_core.PgTableWithColumns<{
    name: "files";
    schema: undefined;
    columns: {
        id: drizzle_orm_pg_core.PgColumn<{
            name: "id";
            tableName: "files";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        ownerId: drizzle_orm_pg_core.PgColumn<{
            name: "owner_id";
            tableName: "files";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        ownerType: drizzle_orm_pg_core.PgColumn<{
            name: "owner_type";
            tableName: "files";
            dataType: "string";
            columnType: "PgText";
            data: "agent" | "human";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: "agent" | "human";
        }>;
        filename: drizzle_orm_pg_core.PgColumn<{
            name: "filename";
            tableName: "files";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        contentType: drizzle_orm_pg_core.PgColumn<{
            name: "content_type";
            tableName: "files";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        sizeBytes: drizzle_orm_pg_core.PgColumn<{
            name: "size_bytes";
            tableName: "files";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        blobUrl: drizzle_orm_pg_core.PgColumn<{
            name: "blob_url";
            tableName: "files";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        sha256: drizzle_orm_pg_core.PgColumn<{
            name: "sha256";
            tableName: "files";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        confirmed: drizzle_orm_pg_core.PgColumn<{
            name: "confirmed";
            tableName: "files";
            dataType: "string";
            columnType: "PgText";
            data: "confirmed" | "pending";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: "confirmed" | "pending";
        }>;
        createdAt: drizzle_orm_pg_core.PgColumn<{
            name: "created_at";
            tableName: "files";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        deletedAt: drizzle_orm_pg_core.PgColumn<{
            name: "deleted_at";
            tableName: "files";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
declare const grants: drizzle_orm_pg_core.PgTableWithColumns<{
    name: "grants";
    schema: undefined;
    columns: {
        id: drizzle_orm_pg_core.PgColumn<{
            name: "id";
            tableName: "grants";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        fileId: drizzle_orm_pg_core.PgColumn<{
            name: "file_id";
            tableName: "grants";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        grantorId: drizzle_orm_pg_core.PgColumn<{
            name: "grantor_id";
            tableName: "grants";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        grantorType: drizzle_orm_pg_core.PgColumn<{
            name: "grantor_type";
            tableName: "grants";
            dataType: "string";
            columnType: "PgText";
            data: "agent" | "human";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: "agent" | "human";
        }>;
        granteeKeyHash: drizzle_orm_pg_core.PgColumn<{
            name: "grantee_key_hash";
            tableName: "grants";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        permissions: drizzle_orm_pg_core.PgColumn<{
            name: "permissions";
            tableName: "grants";
            dataType: "json";
            columnType: "PgJsonb";
            data: string[];
            driverParam: unknown;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: string[];
        }>;
        expiresAt: drizzle_orm_pg_core.PgColumn<{
            name: "expires_at";
            tableName: "grants";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        revokedAt: drizzle_orm_pg_core.PgColumn<{
            name: "revoked_at";
            tableName: "grants";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: drizzle_orm_pg_core.PgColumn<{
            name: "created_at";
            tableName: "grants";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
declare const nonces: drizzle_orm_pg_core.PgTableWithColumns<{
    name: "nonces";
    schema: undefined;
    columns: {
        nonce: drizzle_orm_pg_core.PgColumn<{
            name: "nonce";
            tableName: "nonces";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        keyHash: drizzle_orm_pg_core.PgColumn<{
            name: "key_hash";
            tableName: "nonces";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: drizzle_orm_pg_core.PgColumn<{
            name: "created_at";
            tableName: "nonces";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        expiresAt: drizzle_orm_pg_core.PgColumn<{
            name: "expires_at";
            tableName: "nonces";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
declare const auditLog: drizzle_orm_pg_core.PgTableWithColumns<{
    name: "audit_log";
    schema: undefined;
    columns: {
        id: drizzle_orm_pg_core.PgColumn<{
            name: "id";
            tableName: "audit_log";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        keyId: drizzle_orm_pg_core.PgColumn<{
            name: "key_id";
            tableName: "audit_log";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        userId: drizzle_orm_pg_core.PgColumn<{
            name: "user_id";
            tableName: "audit_log";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        action: drizzle_orm_pg_core.PgColumn<{
            name: "action";
            tableName: "audit_log";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        resourceType: drizzle_orm_pg_core.PgColumn<{
            name: "resource_type";
            tableName: "audit_log";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        resourceId: drizzle_orm_pg_core.PgColumn<{
            name: "resource_id";
            tableName: "audit_log";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        timestamp: drizzle_orm_pg_core.PgColumn<{
            name: "timestamp";
            tableName: "audit_log";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        metadata: drizzle_orm_pg_core.PgColumn<{
            name: "metadata";
            tableName: "audit_log";
            dataType: "json";
            columnType: "PgJsonb";
            data: Record<string, unknown>;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: Record<string, unknown>;
        }>;
    };
    dialect: "pg";
}>;

declare function generateKeyPair(): Promise<{
    publicKey: CryptoKey;
    privateKey: CryptoKey;
}>;
declare function exportPublicKey(key: CryptoKey): Promise<string>;
declare function exportPrivateKey(key: CryptoKey): Promise<string>;
declare function importPublicKey(jwkString: string): Promise<CryptoKey>;
declare function importPrivateKey(jwkString: string): Promise<CryptoKey>;
declare function hashPublicKey(publicKey: CryptoKey): Promise<string>;

declare function buildCanonicalString(method: string, path: string, timestamp: string, nonce: string, bodyHash: string): string;
declare function hashBody(body: string | undefined): Promise<string>;
declare function signRequest(privateKey: CryptoKey, method: string, path: string, body?: string): Promise<{
    timestamp: string;
    nonce: string;
    signature: string;
    bodyHash: string;
}>;

declare function verifySignature(publicKey: CryptoKey, signature: string, method: string, path: string, timestamp: string, nonce: string, body?: string): Promise<boolean>;
declare function isTimestampValid(timestamp: string, toleranceSeconds?: number): boolean;

declare function createGrantJWT(signingKey: CryptoKey, payload: {
    fileId: string;
    granteeKeyHash: string;
    grantId: string;
    permissions: string[];
    ttlSeconds: number;
}): Promise<string>;
declare function verifyGrantJWT(publicKey: CryptoKey, token: string): Promise<{
    fileId: string;
    granteeKeyHash: string;
    grantId: string;
    permissions: string[];
}>;
declare function exportJWKS(publicKey: CryptoKey): Promise<{
    keys: object[];
}>;

export { type AgentAuth, type AgentKeyRecord, type ApiError, type AuditLogEntry, type AuditLogResponse, type AuthContext, type CreateGrantRequest, type CreateGrantResponse, type CreateKeyRequest, type CreateKeyResponse, DEFAULT_API_BASE_URL, type FileDownloadResponse, type FileListResponse, type FileRecord, GRANT_DEFAULT_TTL_SECONDS, GRANT_ISSUER, type GrantListResponse, type GrantRecord, HEADER_KEY_HASH, HEADER_NONCE, HEADER_SIGNATURE, HEADER_TIMESTAMP, type HumanAuth, type KeyListResponse, type SignedHeaders, TIMESTAMP_TOLERANCE_SECONDS, type UploadConfirmRequest, type UploadRequest, type UploadResponse, agentKeys, auditLog, buildCanonicalString, createGrantJWT, createGrantSchema, createKeySchema, exportJWKS, exportPrivateKey, exportPublicKey, files, generateKeyPair, grants, hashBody, hashPublicKey, importPrivateKey, importPublicKey, isTimestampValid, nonces, signRequest, uploadConfirmSchema, uploadRequestSchema, verifyGrantJWT, verifySignature };
