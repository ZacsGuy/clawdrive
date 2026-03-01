export interface FileRecord {
  id: string;
  ownerId: string;
  ownerType: "human" | "agent";
  filename: string;
  contentType: string;
  sizeBytes: number;
  blobUrl: string;
  sha256: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface UploadRequest {
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface UploadResponse {
  uploadUrl: string;
  fileId: string;
}

export interface UploadConfirmRequest {
  fileId: string;
  sha256: string;
}

export interface FileListResponse {
  files: FileRecord[];
}

export interface FileDownloadResponse {
  downloadUrl: string;
}
