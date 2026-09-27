import type { NietemoClient } from './client';
import type { StoredFile, StorageUploadResponse, ListFilesOptions } from './types/storage';
import { NietemoError } from './errors';

export class NietemoStorage {
  private readonly client: NietemoClient;

  constructor(client: NietemoClient) {
    this.client = client;
  }

  /**
   * Upload a file (Blob, File, or Buffer) to Nietemo Cloud Storage (Cloudflare R2)
   */
  public async upload(
    file: any,
    fileName: string,
    options: { contentType?: string } = {}
  ): Promise<StorageUploadResponse> {
    if (!file || !fileName) {
      throw new NietemoError('File and fileName are required for storage upload', 'INVALID_PARAMS');
    }

    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('appId', this.client.appId);
    if (options.contentType) {
      formData.append('contentType', options.contentType);
    }

    return this.client.request<StorageUploadResponse>('/api/baas/storage/upload', {
      method: 'POST',
      body: formData as any,
      headers: {
        // Leave Content-Type empty so fetch sets multipart/form-data with boundary
      },
    });
  }

  /**
   * Delete a stored file by key
   */
  public async delete(key: string): Promise<boolean> {
    if (!key) {
      throw new NietemoError('Storage file key is required for delete', 'INVALID_PARAMS');
    }

    const res = await this.client.request<{ success: boolean }>('/api/baas/storage', {
      method: 'DELETE',
      body: JSON.stringify({
        appId: this.client.appId,
        key,
      }),
    });

    return !!res.success;
  }

  /**
   * List files stored in this application tenant
   */
  public async listFiles(options: ListFilesOptions = {}): Promise<StoredFile[]> {
    const params = new URLSearchParams({ appId: this.client.appId });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.prefix) params.set('prefix', options.prefix);

    const res = await this.client.request<{ success: boolean; files: StoredFile[] }>(
      `/api/baas/storage?${params.toString()}`,
      { method: 'GET' }
    );

    return res.files || [];
  }

  /**
   * Generate a public URL for a stored asset
   */
  public getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, '');
    return `${this.client.endpoint}/api/baas/storage/${encodeURIComponent(this.client.appId)}/${cleanKey}`;
  }

  /**
   * Generate a presigned download URL for private documents
   */
  public async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!key) {
      throw new NietemoError('Storage file key is required to get download URL', 'INVALID_PARAMS');
    }

    const params = new URLSearchParams({
      appId: this.client.appId,
      key,
      action: 'download',
      expiresIn: String(expiresIn),
    });

    const res = await this.client.request<{ success: boolean; downloadUrl: string }>(
      `/api/baas/storage?${params.toString()}`,
      { method: 'GET' }
    );

    return res.downloadUrl || this.getPublicUrl(key);
  }
}
