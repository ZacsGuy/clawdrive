import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { FileDownloadResponse, AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { files } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getDownloadUrl } from "@/lib/blob";
import { verifyGrant } from "@/lib/grants";
import { logAudit } from "@/lib/audit";
import { notFound, forbidden } from "@/lib/errors";

export const GET = withAuth(async (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: AuthContext,
) => {
  const { id } = await ctx.params;

  // Fetch the file, ensuring it is not deleted and is confirmed
  const file = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!file) {
    return notFound("File not found");
  }

  if (file.confirmed !== "confirmed" || !file.blobUrl) {
    return notFound("File upload not yet confirmed");
  }

  const callerId = auth!.type === "human" ? auth!.userId : auth!.keyHash;

  // If the caller is the owner, allow direct download
  if (file.ownerId === callerId) {
    const downloadUrl = getDownloadUrl(file.blobUrl);

    await logAudit(auth!, "file.download", "file", id, { access: "owner" });

    const response: FileDownloadResponse = { downloadUrl };
    return NextResponse.json(response);
  }

  // If the caller is an agent with a grant token, verify the grant
  if (auth!.type === "agent") {
    const tokenParam = req.nextUrl.searchParams.get("token");
    if (!tokenParam) {
      return forbidden(
        "You do not own this file. Provide a grant token via ?token= query parameter.",
      );
    }

    const result = await verifyGrant(tokenParam, auth!.keyHash);

    if (!result.valid) {
      return forbidden(`Grant verification failed: ${result.reason}`);
    }

    // Ensure the grant is for this specific file
    if (result.fileId !== id) {
      return forbidden("Grant is not valid for this file");
    }

    // Ensure the grant includes download permission
    if (!result.permissions.includes("download")) {
      return forbidden("Grant does not include download permission");
    }

    const downloadUrl = getDownloadUrl(file.blobUrl);

    await logAudit(auth!, "file.download", "file", id, {
      access: "grant",
      grantId: result.grantId,
    });

    const response: FileDownloadResponse = { downloadUrl };
    return NextResponse.json(response);
  }

  // Human caller who is not the owner
  return forbidden("You do not own this file");
});
