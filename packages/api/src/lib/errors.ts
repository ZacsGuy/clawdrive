import { NextResponse } from "next/server";
import type { ApiError } from "@agentdrop/shared";

export function apiError(
  message: string,
  code: string,
  status: number,
  details?: unknown,
): NextResponse<ApiError> {
  const body: ApiError = { error: message, code };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

export function badRequest(message: string, details?: unknown) {
  return apiError(message, "BAD_REQUEST", 400, details);
}

export function unauthorized(message = "Unauthorized") {
  return apiError(message, "UNAUTHORIZED", 401);
}

export function forbidden(message = "Forbidden") {
  return apiError(message, "FORBIDDEN", 403);
}

export function notFound(message = "Not found") {
  return apiError(message, "NOT_FOUND", 404);
}

export function conflict(message: string) {
  return apiError(message, "CONFLICT", 409);
}

export function internalError(message = "Internal server error") {
  return apiError(message, "INTERNAL_ERROR", 500);
}
