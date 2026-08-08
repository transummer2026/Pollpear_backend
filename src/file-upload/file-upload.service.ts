import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

export type ImageKind = 'avatar' | 'banner';

const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/gif',
  'image/heif',
  'image/heic',
];
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000;
const BANNER_WIDTH = 1500;
const BANNER_HEIGHT = 500;
const AVATAR_WIDTH = 512;
const AVATAR_HEIGHT = 512;

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  validate(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('no file uploaded');
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('invalid file type');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('file is too large!');
    }
  }

  async processImage(
    file: Express.Multer.File,
    kind: ImageKind,
  ): Promise<Buffer> {
    this.validate(file);
    const resize = this.resizeFor(kind);
    try {
      return await sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(resize)
        .webp({ quality: 82 })
        .toBuffer();
    } catch (error) {
      this.logger.error('Failed to process image', error);
      throw new BadRequestException('invalid or unsupported image');
    }
  }

  private resizeFor(kind: ImageKind): sharp.ResizeOptions {
    switch (kind) {
      case 'avatar':
        return { width: AVATAR_WIDTH, height: AVATAR_HEIGHT, fit: 'cover' };
      case 'banner':
        return { width: BANNER_WIDTH, height: BANNER_HEIGHT, fit: 'cover' };
      default: {
        const exhaustive: never = kind;
        throw new BadRequestException(
          `unknown image kind: ${String(exhaustive)}`,
        );
      }
    }
  }
}
