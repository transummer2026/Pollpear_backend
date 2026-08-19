import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from 'src/api-key/api-key.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { UsersService } from 'src/users/users.service';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
import { MeService } from './me.service';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    username: 'valid_user',
    name: null,
    surname: null,
    email: 'user@example.com',
    birthdate: new Date('1990-01-01'),
    passwordHash: 'stored-hash',
    role: 'user',
    gender: 'other',
    nationality: 'french',
    city: null,
    state: null,
    country: null,
    company: null,
    bio: null,
    score: 0,
    isOnline: false,
    isEmailVerified: true,
    visibility: 'public',
    lastSeenAt: null,
    avatarUrl: '/uploads/avatars/default.svg',
    bannerUrl: '/uploads/banners/default.svg',
    userTheme: 'light',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  };
}

describe('MeService', () => {
  const update = jest.fn();
  const prisma = { user: { update } } as unknown as PrismaService;

  const findByUserId = jest.fn();
  const users = { findByUserId } as unknown as UsersService;

  const processImage = jest.fn();
  const fileUpload = { processImage } as unknown as FileUploadService;

  const save = jest.fn();
  const publicUrl = jest.fn();
  const storage = { save, publicUrl } as unknown as StorageService;

  const revokeUser = jest.fn();
  const emitter = { revokeUser } as unknown as WebsocketEmitter;

  const revokeAll = jest.fn();
  const apiKeys = { revokeAll } as unknown as ApiKeyService;

  const service = new MeService(
    prisma,
    users,
    fileUpload,
    storage,
    emitter,
    apiKeys,
  );

  beforeEach(() => jest.clearAllMocks());

  describe('myProfile', () => {
    it('rejects an unknown user', async () => {
      findByUserId.mockResolvedValue(null);

      await expect(service.myProfile(7)).rejects.toThrow(UnauthorizedException);
    });

    it('returns the profile stripped of its private columns', async () => {
      findByUserId.mockResolvedValue(makeUser());

      const profile = await service.myProfile(7);

      expect(profile).toMatchObject({ id: 7, username: 'valid_user' });
      expect(profile).not.toHaveProperty('passwordHash');
    });
  });

  describe('uploadAvatar', () => {
    it('rejects an unknown user before touching the file', async () => {
      findByUserId.mockResolvedValue(null);

      await expect(
        service.uploadAvatar(7, {} as Express.Multer.File),
      ).rejects.toThrow(UnauthorizedException);
      expect(processImage).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('stores the processed image under the user key and busts the url cache', async () => {
      findByUserId.mockResolvedValue(makeUser());
      const image = Buffer.from('webp-bytes');
      processImage.mockResolvedValue(image);
      publicUrl.mockReturnValue('https://cdn.test/uploads/avatars/7.webp');
      update.mockResolvedValue(
        makeUser({ avatarUrl: 'https://cdn.test/uploads/avatars/7.webp?v=1' }),
      );
      const file = { buffer: Buffer.alloc(1) } as Express.Multer.File;

      const result = await service.uploadAvatar(7, file);

      expect(processImage).toHaveBeenCalledWith(file, 'avatar');
      expect(save).toHaveBeenCalledWith('avatars/7.webp', image, 'image/webp');
      expect(publicUrl).toHaveBeenCalledWith('avatars/7.webp');
      const [updateArg] = update.mock.calls[0] as [
        { where: { id: number }; data: { avatarUrl: string } },
      ];
      expect(updateArg.where).toEqual({ id: 7 });
      expect(updateArg.data.avatarUrl).toMatch(
        /^https:\/\/cdn\.test\/uploads\/avatars\/7\.webp\?v=\d+$/,
      );
      expect(result.avatarUrl).toBe(
        'https://cdn.test/uploads/avatars/7.webp?v=1',
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes the account and revokes every live credential', async () => {
      update.mockResolvedValue(makeUser({ deletedAt: new Date() }));

      await service.remove(7);

      const [updateArg] = update.mock.calls[0] as [
        { where: { id: number }; data: { deletedAt: Date } },
      ];
      expect(updateArg.where).toEqual({ id: 7 });
      expect(updateArg.data.deletedAt).toBeInstanceOf(Date);
      expect(revokeAll).toHaveBeenCalledWith(7);
      expect(revokeUser).toHaveBeenCalledWith(7);
    });
  });
});
