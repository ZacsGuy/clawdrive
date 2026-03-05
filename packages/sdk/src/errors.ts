export class AgentDropError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "AgentDropError";
    this.code = code;
    this.status = status;
  }
}

export class AuthenticationError extends AgentDropError {
  constructor(message = "Authentication failed") {
    super(message, "AUTHENTICATION_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends AgentDropError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AgentDropError {
  constructor(message = "Validation failed") {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class PermissionError extends AgentDropError {
  constructor(message = "Permission denied") {
    super(message, "PERMISSION_ERROR", 403);
    this.name = "PermissionError";
  }
}
