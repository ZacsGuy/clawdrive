import { put } from "@vercel/blob";

/**
 * Upload content to Vercel Blob and return the blob URL.
 */
export async function uploadToBlob(
  filename: string,
  contentType: string,
  body: string | ArrayBuffer | Buffer | ReadableStream,
): Promise<string> {
  const blob = await put(filename, body as Parameters<typeof put>[1], {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}

/**
 * Get a download URL for a file stored in Vercel Blob.
 * Blob URLs are publicly accessible, so we return the URL directly.
 */
export function getDownloadUrl(blobUrl: string): string {
  return blobUrl;
}
