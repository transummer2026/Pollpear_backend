import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { AvatarService } from './avatar.service';
import { FileUploadService } from './file-upload.service';

describe('AvatarService', () => {
  const update = jest.fn();
  const prisma = { user: { update } } as unknown as PrismaService;

  const save = jest.fn();
  const publicUrl = jest.fn();
  const storage = { save, publicUrl } as unknown as StorageService;

  const processImage = jest.fn();
  const fileUpload = { processImage } as unknown as FileUploadService;

  const service = new AvatarService(prisma, storage, fileUpload);

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => jest.clearAllMocks());

  it('stores the processed image under the user key and busts the url cache', async () => {
    const image = Buffer.from('webp-bytes');
    processImage.mockResolvedValue(image);
    publicUrl.mockReturnValue('https://cdn.test/uploads/avatars/7.webp');
    update.mockResolvedValue({ id: 7 });
    const file = { buffer: Buffer.alloc(1) } as Express.Multer.File;

    await service.replace(7, file);

    expect(processImage).toHaveBeenCalledWith(file, 'avatar');
    expect(save).toHaveBeenCalledWith('avatars/7.webp', image, 'image/webp');
    expect(publicUrl).toHaveBeenCalledWith('avatars/7.webp');
    const [updateArg] = update.mock.calls[0] as [
      {
        where: { id: number; deletedAt: null };
        data: { avatarUrl: string };
        omit: { passwordHash: true };
      },
    ];
    expect(updateArg.where).toEqual({ id: 7, deletedAt: null });
    expect(updateArg.data.avatarUrl).toMatch(
      /^https:\/\/cdn\.test\/uploads\/avatars\/7\.webp\?v=\d+$/,
    );
    expect(updateArg.omit).toEqual({ passwordHash: true });
  });

  it('touches neither storage nor the database when the image cannot be processed', async () => {
    processImage.mockRejectedValue(new Error('invalid image'));
    const file = { buffer: Buffer.alloc(1) } as Express.Multer.File;

    await expect(service.replace(7, file)).rejects.toThrow('invalid image');
    expect(save).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
