import {
  DEFAULT_API_BASE_URL,
  type FileRecord,
  type FileListResponse,
  type FileDownloadResponse,
  type UploadResponse,
  type GrantRecord,
  type CreateGrantResponse,
  type GrantListResponse,
  type ApiError,
} from "@agentdrop/shared";
import { createSignedHeaders } from "./signer.js";
import {
  AgentDropError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  PermissionError,
} from "./errors.js";

export interface AgentDropClientOptions {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  baseUrl?: string;
}

export class AgentDropClient {
  private readonly privateKey: CryptoKey;
  private readonly publicKey: CryptoKey;
  private readonly baseUrl: string;

  constructor(options: AgentDropClientOptions) {
    this.privateKey = options.privateKey;
    this.publicKey = options.publicKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
  }

  /**
   * Internal helper to make authenticated requests to the AgentDrop API.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;

    const signedHeaders = await createSignedHeaders(
      this.privateKey,
      this.publicKey,
      method,
      path,
      bodyStr,
    );

    const headers: Record<string, string> = {
      ...signedHeaders,
    };

    if (bodyStr !== undefined) {
      headers["content-type"] = "application/json";
    }

    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers,
      body: bodyStr,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  /**
   * Parse error response and throw the appropriate typed error.
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: ApiError | undefined;
    try {
      errorBody = (await response.json()) as ApiError;
    } catch {
      // Response body may not be JSON
    }

    const message = errorBody?.error ?? response.statusText;

    switch (response.status) {
      case 400:
        throw new ValidationError(message);
      case 401:
        throw new AuthenticationError(message);
      case 403:
        throw new PermissionError(message);
      case 404:
        throw new NotFoundError(message);
      default:
        throw new AgentDropError(
          message,
          errorBody?.code ?? "UNKNOWN_ERROR",
          response.status,
        );
    }
  }

  /**
   * Upload a file to AgentDrop.
   *
   * 1. POST /api/upload to get a presigned upload URL
   * 2. PUT the file content to the presigned URL
   * 3. POST /api/upload/confirm to finalize
   *
   * @param file - A File or Buffer containing the file data
   * @param filename - The name of the file
   * @param contentType - MIME type of the file
   * @returns The confirmed file record
   */
  async upload(
    file: File | Blob | ArrayBuffer,
    filename: string,
    contentType: string,
  ): Promise<FileRecord> {
    const arrayBuffer =
      file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const sizeBytes = arrayBuffer.byteLength;

    // Step 1: Request presigned upload URL
    const uploadResponse = await this.request<UploadResponse>(
      "POST",
      "/api/upload",
      {
        filename,
        contentType,
        sizeBytes,
      },
    );

    // Step 2: Upload file content to presigned URL
    const uploadResult = await fetch(uploadResponse.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": contentType,
      },
      body: arrayBuffer,
    });

    if (!uploadResult.ok) {
      throw new AgentDropError(
        `Failed to upload file to storage: ${uploadResult.statusText}`,
        "UPLOAD_FAILED",
        uploadResult.status,
      );
    }

    // Step 3: Compute SHA-256 hash and confirm upload
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const sha256 = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const confirmResponse = await this.request<{ file: FileRecord }>(
      "POST",
      "/api/upload/confirm",
      {
        fileId: uploadResponse.fileId,
        sha256,
      },
    );

    return confirmResponse.file;
  }

  /**
   * Download a file from AgentDrop.
   *
   * @param fileId - The ID of the file to download
   * @param grantToken - Optional grant JWT for accessing shared files
   * @returns The response body as a ReadableStream
   */
  async download(
    fileId: string,
    grantToken?: string,
  ): Promise<ReadableStream<Uint8Array>> {
    const path = `/api/files/${fileId}/download`;
    const queryParams = grantToken ? `?token=${encodeURIComponent(grantToken)}` : "";
    const fullPath = `${path}${queryParams}`;

    const downloadInfo = await this.request<FileDownloadResponse>(
      "GET",
      fullPath,
    );

    // Fetch the actual file from the download URL
    const fileResponse = await fetch(downloadInfo.downloadUrl);
    if (!fileResponse.ok) {
      throw new AgentDropError(
        `Failed to download file: ${fileResponse.statusText}`,
        "DOWNLOAD_FAILED",
        fileResponse.status,
      );
    }

    if (!fileResponse.body) {
      throw new AgentDropError(
        "Download response has no body",
        "DOWNLOAD_FAILED",
        500,
      );
    }

    return fileResponse.body;
  }

  /**
   * List all files owned by the authenticated agent.
   */
  async listFiles(): Promise<FileListResponse> {
    return this.request<FileListResponse>("GET", "/api/files");
  }

  /**
   * Get metadata for a single file.
   *
   * @param fileId - The ID of the file
   */
  async getFile(fileId: string): Promise<FileRecord> {
    const response = await this.request<{ file: FileRecord }>(
      "GET",
      `/api/files/${fileId}`,
    );
    return response.file;
  }

  /**
   * Delete a file.
   *
   * @param fileId - The ID of the file to delete
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.request<void>("DELETE", `/api/files/${fileId}`);
  }

  /**
   * Create a grant to share file access with another agent.
   *
   * @param fileId - The ID of the file to share
   * @param granteeKeyHash - The public key hash of the grantee
   * @param permissions - Array of permissions to grant (e.g. ["download"])
   * @param ttlSeconds - Time-to-live in seconds for the grant
   * @returns The created grant record and JWT token
   */
  async createGrant(
    fileId: string,
    granteeKeyHash: string,
    permissions: string[],
    ttlSeconds: number,
  ): Promise<CreateGrantResponse> {
    return this.request<CreateGrantResponse>("POST", "/api/grant", {
      fileId,
      granteeKeyHash,
      permissions,
      ttlSeconds,
    });
  }

  /**
   * Revoke an existing grant.
   *
   * @param grantId - The ID of the grant to revoke
   */
  async revokeGrant(grantId: string): Promise<void> {
    await this.request<void>("DELETE", `/api/grant/${grantId}`);
  }

  /**
   * List all grants for a specific file.
   *
   * @param fileId - The ID of the file
   */
  async listGrantsForFile(fileId: string): Promise<GrantListResponse> {
    return this.request<GrantListResponse>(
      "GET",
      `/api/grants/file/${fileId}`,
    );
  }

  /**
   * List all grants received by the authenticated agent.
   */
  async listReceivedGrants(): Promise<GrantListResponse> {
    return this.request<GrantListResponse>("GET", "/api/grants/received");
  }
}
