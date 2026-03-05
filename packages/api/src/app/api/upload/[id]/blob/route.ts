import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import type { AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { files } from "@/db/schema";
import { uploadToBlob } from "@/lib/blob";
import { logAudit } from "@/lib/audit";
import { badRequest, notFound, forbidden, internalError } from "@/lib/errors";

export const PUT = withAuth(async (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: AuthContext,
) => {
  const { id } = await ctx.params;
  const callerId = auth.type === "human" ? auth.userId : auth.keyHash;

  // Look up the pending file
  const file = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt)))
    .then((rows) => rows[0]);

  if (!file) return notFound("File not found");
  if (file.ownerId !== callerId) return forbidden("Not the file owner");
  if (file.confirmed === "confirmed") return badRequest("File already uploaded");

  // Read the raw body
  const body = await req.arrayBuffer();
  if (body.byteLength === 0) return badRequest("Empty file body");

  // Upload to Vercel Blob
  let blobUrl: string;
  try {
    blobUrl = await uploadToBlob(file.filename, file.contentType, body);
  } catch (err) {
    console.error("Failed to upload to blob:", err);
    return internalError("Failed to upload file");
  }

  // Compute SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", body);
  const sha256 = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Update file record
  await db
    .update(files)
    .set({ blobUrl, sha256, confirmed: "confirmed" })
    .where(eq(files.id, id));

  const updated = await db
    .select()
    .from(files)
    .where(eq(files.id, id))
    .then((rows) => rows[0]);

  await logAudit(auth, "upload.complete", "file", id, { blobUrl, sha256 });

  return NextResponse.json({ file: updated });
});
