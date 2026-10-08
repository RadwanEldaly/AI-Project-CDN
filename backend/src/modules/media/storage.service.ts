import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

export interface StorageProvider {
  generatePresignedUploadUrl(
    storageKey: string,
    mimeType: string,
    byteSize: number,
    expiresInSeconds: number
  ): Promise<string>;
  saveRawUpload(storageKey: string, fileBuffer: Buffer): Promise<void>;
  getRawUploadStream(storageKey: string): Promise<fs.ReadStream>;
  deleteObject(storageKey: string): Promise<void>;
  saveProcessedMedia(storageKey: string, fileBuffer: Buffer, mimeType: string): Promise<string>;
}

/**
 * Local file-based storage provider implementing the exact S3 pre-signed URL handshake
 */
export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private cdnBaseUrl: string;

  constructor(baseDir?: string, cdnBaseUrl?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), '.data', 'storage');
    this.cdnBaseUrl = cdnBaseUrl || process.env.CDN_BASE_URL || '/media-cdn';
    
    // Ensure base directory tree exists
    const rawDir = path.join(this.baseDir, 'raw-uploads');
    const processedDir = path.join(this.baseDir, 'processed');
    if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
    if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });
  }

  async generatePresignedUploadUrl(
    storageKey: string,
    _mimeType: string,
    _byteSize: number,
    expiresInSeconds: number
  ): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const secret = process.env.STORAGE_SIGNING_SECRET || 'devspace-local-storage-secret-key-32';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${storageKey}:${expiresAt}`)
      .digest('hex');

    // Local upload endpoint acting as the S3 pre-signed URL target
    return `/api/v1/media/upload?key=${encodeURIComponent(storageKey)}&expires=${expiresAt}&sig=${signature}`;
  }

  verifyPresignedUploadUrl(storageKey: string, expiresAt: number, signature: string): boolean {
    if (Date.now() > expiresAt) {
      return false;
    }
    const secret = process.env.STORAGE_SIGNING_SECRET || 'devspace-local-storage-secret-key-32';
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${storageKey}:${expiresAt}`)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  }

  async saveRawUpload(storageKey: string, fileBuffer: Buffer): Promise<void> {
    const fullPath = path.join(this.baseDir, storageKey);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(fullPath, fileBuffer);
  }

  async getRawUploadStream(storageKey: string): Promise<fs.ReadStream> {
    const fullPath = path.join(this.baseDir, storageKey);
    return fs.createReadStream(fullPath);
  }

  async deleteObject(storageKey: string): Promise<void> {
    const fullPath = path.join(this.baseDir, storageKey);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }

  async saveProcessedMedia(
    storageKey: string,
    fileBuffer: Buffer,
    _mimeType: string
  ): Promise<string> {
    const fullPath = path.join(this.baseDir, 'processed', storageKey);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(fullPath, fileBuffer);
    return `${this.cdnBaseUrl}/${storageKey}`;
  }

  getProcessedFilePath(storageKey: string): string {
    return path.join(this.baseDir, 'processed', storageKey);
  }
}
