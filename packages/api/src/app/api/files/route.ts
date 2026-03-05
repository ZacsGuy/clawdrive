import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { FileListResponse, FileRecord, AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { files } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export const GET = withAuth(async (_req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, auth: AuthContext) => {
  const ownerId = auth!.type === "human" ? auth!.userId : auth!.keyHash;

  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.ownerId, ownerId), isNull(files.deletedAt)))
    .orderBy(files.createdAt);

  const fileRecords: FileRecord[] = rows.map((row) => ({
    id: row.id,
    ownerId: row.ownerId,
    ownerType: row.ownerType,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    blobUrl: row.blobUrl ?? "",
    sha256: row.sha256 ?? "",
    createdAt: row.createdAt.toISOString(),
    deletedAt: null,
  }));

  const response: FileListResponse = { files: fileRecords };
  return NextResponse.json(response);
});
