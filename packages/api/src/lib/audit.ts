import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { AuthContext } from "@agentdrop/shared";

export async function logAudit(
  auth: AuthContext,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  // Resolve keyId for agent auth: look up the agent_keys row by keyHash
  let keyId: string | null = null;
  let userId: string | null = null;

  if (auth.type === "agent") {
    const { agentKeys } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const key = await db
      .select({ id: agentKeys.id })
      .from(agentKeys)
      .where(eq(agentKeys.keyHash, auth.keyHash))
      .limit(1)
      .then((rows) => rows[0]);
    keyId = key?.id ?? null;
  } else {
    userId = auth.userId;
  }

  await db.insert(auditLog).values({
    keyId,
    userId,
    action,
    resourceType,
    resourceId,
    metadata: metadata ?? null,
  });
}
