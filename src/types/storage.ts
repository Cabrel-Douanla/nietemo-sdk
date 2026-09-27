/**
 * Storage Types & Interfaces
 */

export interface StoredFile {
  id: string;
  key: string;
  fileName: string;
  size: number;
  mimeType: string;
  publicUrl: string;
  provider: 'CLOUDFLARE_R2' | 'LOCAL' | string;
  createdAt: string;
}

export interface StorageUploadResponse {
  success: boolean;
  fileUrl: string;
  publicUrl: string;
  key: string;
  storageKey?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  provider?: string;
  uploadedAt?: string;
  error?: string;
}

export interface ListFilesOptions {
  prefix?: string;
  limit?: number;
}
