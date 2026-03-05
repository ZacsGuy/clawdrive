import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { FileRecord, AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { files } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { notFound, forbidden } from "@/lib/errors";

export const GET = withAuth(async (
  _req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: AuthContext,
) => {
  const { id } = await ctx.params;
  const ownerId = auth!.type === "human" ? auth!.userId : auth!.keyHash;

  const file = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!file) {
    return notFound("File not found");
  }

  if (file.ownerId !== ownerId) {
    return forbidden("You do not own this file");
  }

  const record: FileRecord = {
    id: file.id,
    ownerId: file.ownerId,
    ownerType: file.ownerType,
    filename: file.filename,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    blobUrl: file.blobUrl ?? "",
    sha256: file.sha256 ?? "",
    createdAt: file.createdAt.toISOString(),
    deletedAt: null,
  };

  return NextResponse.json({ file: record });
});

export const DELETE = withAuth(async (
  _req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: AuthContext,
) => {
  const { id } = await ctx.params;
  const ownerId = auth!.type === "human" ? auth!.userId : auth!.keyHash;

  const file = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!file) {
    return notFound("File not found");
  }

  if (file.ownerId !== ownerId) {
    return forbidden("You do not own this file");
  }

  // Soft delete
  await db
    .update(files)
    .set({ deletedAt: new Date() })
    .where(eq(files.id, id));

  await logAudit(auth!, "file.delete", "file", id);

  return NextResponse.json({ deleted: true });
});
