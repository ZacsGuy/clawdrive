import { z } from "zod";

export const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024), // 100MB
});

export const uploadConfirmSchema = z.object({
  fileId: z.string().uuid(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export const createGrantSchema = z.object({
  fileId: z.string().uuid(),
  granteeKeyHash: z.string().min(1),
  permissions: z.array(z.enum(["download"])).min(1),
  ttlSeconds: z.number().int().positive().max(86400), // max 24h
});

export const createKeySchema = z.object({
  label: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  publicKey: z.string().min(1),
});
