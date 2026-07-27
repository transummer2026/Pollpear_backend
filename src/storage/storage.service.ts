import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { VaultService } from 'src/vault/vault.service';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(vault: VaultService) {
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

  // Ecrit (ou ecrase) un objet dans le bucket Garage.
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

  // URL publique relative, servie par nginx (location /uploads/ -> web Garage).
  publicUrl(key: string): string {
    return `/uploads/${key}`;
  }
}
