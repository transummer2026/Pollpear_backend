// src/file-upload/avatar.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { FileUploadService } from './file-upload.service';

const AVATAR_CONTENT_TYPE = 'image/webp';

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly fileUpload: FileUploadService,
  ) {}

  async replace(userId: number, file: Express.Multer.File) {
    const image = await this.fileUpload.processImage(file, 'avatar');
    const key = this.keyFor(userId);
    await this.storage.save(key, image, AVATAR_CONTENT_TYPE);

    const avatarUrl = `${this.storage.publicUrl(key)}?v=${Date.now()}`;
    this.logger.log(`avatar of user ${userId} stored at ${key}`);

    return await this.prisma.user.update({
      where: { id: userId, deletedAt: null },
      data: { avatarUrl },
      omit: { passwordHash: true },
    });
  }

  private keyFor(userId: number): string {
    return `avatars/${userId}.webp`;
  }
}
