import { NextResponse } from "next/server";
import { exportJWKS } from "@agentdrop/shared";
import { getSigningPublicKey } from "@/lib/grants";

export async function GET() {
  try {
    const publicKey = await getSigningPublicKey();
    const jwks = await exportJWKS(publicKey);

    return NextResponse.json(jwks, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("Failed to export JWKS:", err);
    return NextResponse.json(
      { error: "Failed to export JWKS", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
