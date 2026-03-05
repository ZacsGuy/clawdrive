import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { uploadRequestSchema } from "@agentdrop/shared";
import type { AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { files } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { badRequest, internalError } from "@/lib/errors";

export const POST = withAuth(async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, auth: AuthContext) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = uploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Validation failed", parsed.error.flatten());
  }

  const { filename, contentType, sizeBytes } = parsed.data;
  const ownerId = auth.type === "human" ? auth.userId : auth.keyHash;
  const ownerType = auth.type;

  // Create pending file record
  let fileRecord: { id: string };
  try {
    const inserted = await db
      .insert(files)
      .values({
        ownerId,
        ownerType,
        filename,
        contentType,
        sizeBytes,
      })
      .returning({ id: files.id });
    fileRecord = inserted[0]!;
  } catch (err) {
    console.error("Failed to create file record:", err);
    return internalError("Failed to create file record");
  }

  await logAudit(auth, "upload.initiate", "file", fileRecord.id, {
    filename,
    contentType,
    sizeBytes,
  });

  return NextResponse.json(
    { uploadUrl: `/api/upload/${fileRecord.id}/blob`, fileId: fileRecord.id },
    { status: 201 },
  );
});
