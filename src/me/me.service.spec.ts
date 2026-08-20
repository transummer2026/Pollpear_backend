import { UnauthorizedException } from '@nestjs/common';
import { AvatarService } from 'src/file-upload/avatar.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RevocationService } from 'src/revocation/revocation.service';
import { UsersService } from 'src/users/users.service';
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

  const replace = jest.fn();
  const avatar = { replace } as unknown as AvatarService;

  const revokeAllAccess = jest.fn();
  const revocation = { revokeAllAccess } as unknown as RevocationService;

  const service = new MeService(prisma, users, avatar, revocation);

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
      expect(replace).not.toHaveBeenCalled();
    });

    it('delegates to the avatar pipeline and returns the refreshed profile', async () => {
      findByUserId.mockResolvedValue(makeUser());
      replace.mockResolvedValue(
        makeUser({ avatarUrl: 'https://cdn.test/uploads/avatars/7.webp?v=1' }),
      );
      const file = { buffer: Buffer.alloc(1) } as Express.Multer.File;

      const result = await service.uploadAvatar(7, file);

      expect(replace).toHaveBeenCalledWith(7, file);
      expect(result.avatarUrl).toBe(
        'https://cdn.test/uploads/avatars/7.webp?v=1',
      );
    });
  });

  describe('remove', () => {
    it('revokes every live credential before soft-deleting the account', async () => {
      update.mockResolvedValue(makeUser({ deletedAt: new Date() }));

      await service.remove(7);

      expect(revokeAllAccess).toHaveBeenCalledWith(7);
      const [updateArg] = update.mock.calls[0] as [
        { where: { id: number }; data: { deletedAt: Date } },
      ];
      expect(updateArg.where).toEqual({ id: 7 });
      expect(updateArg.data.deletedAt).toBeInstanceOf(Date);
      expect(revokeAllAccess.mock.invocationCallOrder[0]).toBeLessThan(
        update.mock.invocationCallOrder[0],
      );
    });
  });
});
