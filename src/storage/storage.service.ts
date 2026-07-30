import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { VaultService } from 'src/vault/vault.service';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly vault: VaultService;

  constructor(vault: VaultService) {
    this.vault = vault;
    this.bucket = vault.s3.bucket;
    this.client = new S3Client({
      endpoint: vault.s3.endpoint,
      region: vault.s3.region,
      credentials: {
        accessKeyId: vault.s3.access_key,
        secretAccessKey: vault.s3.secret_key,
      },
      forcePathStyle: true,
    });
  }

  async save(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  publicUrl(key: string): string {
    return `${this.vault.app.gateway_url}/uploads/${key}`;
  }
}
