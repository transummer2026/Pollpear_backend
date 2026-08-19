import { BadRequestException, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { FileUploadService } from './file-upload.service';

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.alloc(0),
    ...overrides,
  } as Express.Multer.File;
}

async function makePng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 200, g: 80, b: 40 },
    },
  })
    .png()
    .toBuffer();
}

describe('FileUploadService', () => {
  const service = new FileUploadService();

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  describe('validate', () => {
    it('rejects a missing file', () => {
      expect(() =>
        service.validate(undefined as unknown as Express.Multer.File),
      ).toThrow('no file uploaded');
    });

    it.each(['application/pdf', 'text/html', 'image/svg+xml'])(
      'rejects the %s mime type',
      (mimetype) => {
        expect(() => service.validate(makeFile({ mimetype }))).toThrow(
          'invalid file type',
        );
      },
    );

    it('rejects a file above 12 MB', () => {
      expect(() =>
        service.validate(makeFile({ size: 12 * 1024 * 1024 + 1 })),
      ).toThrow('file is too large!');
    });

    it('accepts an allowed image within the size limit', () => {
      expect(() =>
        service.validate(makeFile({ size: 12 * 1024 * 1024 })),
      ).not.toThrow();
    });
  });

  describe('processImage', () => {
    it('turns an avatar into a 512x512 webp', async () => {
      const buffer = await makePng();

      const out = await service.processImage(
        makeFile({ buffer, size: buffer.length }),
        'avatar',
      );

      const metadata = await sharp(out).metadata();
      expect(metadata).toMatchObject({
        format: 'webp',
        width: 512,
        height: 512,
      });
    });

    it('turns a banner into a 1500x500 webp', async () => {
      const buffer = await makePng();

      const out = await service.processImage(
        makeFile({ buffer, size: buffer.length }),
        'banner',
      );

      const metadata = await sharp(out).metadata();
      expect(metadata).toMatchObject({
        format: 'webp',
        width: 1500,
        height: 500,
      });
    });

    it('rejects a corrupt buffer as an unsupported image', async () => {
      const buffer = Buffer.from('definitely not an image');

      const call = service.processImage(
        makeFile({ buffer, size: buffer.length }),
        'avatar',
      );

      await expect(call).rejects.toThrow(BadRequestException);
      await expect(call).rejects.toThrow('invalid or unsupported image');
    });

    it('runs validation before touching the buffer', async () => {
      await expect(
        service.processImage(makeFile({ mimetype: 'text/plain' }), 'avatar'),
      ).rejects.toThrow('invalid file type');
    });
  });
});
