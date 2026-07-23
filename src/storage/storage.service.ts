import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('GARAGE_S3_BUCKET');
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('GARAGE_S3_ENDPOINT'),
      region: config.getOrThrow<string>('GARAGE_S3_REGION'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('GARAGE_S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('GARAGE_S3_SECRET_KEY'),
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
