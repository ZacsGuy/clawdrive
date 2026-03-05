import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { uploadConfirmSchema } from "@agentdrop/shared";
import type { AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { files } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { badRequest, notFound, forbidden, conflict } from "@/lib/errors";

export const POST = withAuth(async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, auth: AuthContext) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = uploadConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Validation failed", parsed.error.flatten());
  }

  const { fileId, sha256 } = parsed.data;

  // Look up the file, ensuring it is not deleted
  const file = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!file) {
    return notFound("File not found");
  }

  // Verify ownership
  const callerId = auth!.type === "human" ? auth!.userId : auth!.keyHash;
  if (file.ownerId !== callerId) {
    return forbidden("You do not own this file");
  }

  // Check the file is still pending
  if (file.confirmed === "confirmed") {
    return conflict("File is already confirmed");
  }

  // The client should have already uploaded to Vercel Blob.
  // The blobUrl is provided by the client after the upload completes.
  // For the confirm flow, the client sends the blobUrl and sha256.
  // We accept a blobUrl from the body if present, or fall back to the stored one.
  let blobUrl: string | null;
  try {
    const rawBody = body as Record<string, unknown>;
    blobUrl = (rawBody.blobUrl as string) ?? file.blobUrl;
  } catch {
    blobUrl = file.blobUrl;
  }

  if (!blobUrl) {
    return badRequest("blobUrl is required when file has no stored URL");
  }

  // Update file record to confirmed
  await db
    .update(files)
    .set({
      blobUrl,
      sha256,
      confirmed: "confirmed" as const,
    })
    .where(eq(files.id, fileId));

  // Audit log
  await logAudit(auth!, "upload.confirm", "file", fileId, { sha256 });

  // Return the updated file record
  const updated = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1)
    .then((rows) => rows[0]!);

  return NextResponse.json({
    file: {
      id: updated.id,
      ownerId: updated.ownerId,
      ownerType: updated.ownerType,
      filename: updated.filename,
      contentType: updated.contentType,
      sizeBytes: updated.sizeBytes,
      blobUrl: updated.blobUrl ?? "",
      sha256: updated.sha256 ?? "",
      createdAt: updated.createdAt.toISOString(),
      deletedAt: null,
    },
  });
});
