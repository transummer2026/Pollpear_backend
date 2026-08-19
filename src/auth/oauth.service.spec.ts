import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash } from 'argon2';
import { type Response } from 'express';
import { type OauthCompleteDTO } from 'Pollpear_shared/src/schemas/oauth.schema';
import { OauthProvider, type User } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { VaultService } from 'src/vault/vault.service';
import { AuthService } from './auth.service';
import { type OauthProfile } from './oauth-profile';
import { OauthService } from './oauth.service';

jest.mock('argon2');

function makeUser(overrides: Partial<User> = {}): User {
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

function makeProfile(overrides: Partial<OauthProfile> = {}): OauthProfile {
  return {
    provider: OauthProvider.google,
    providerUserId: 'provider-user-1',
    providerUrl: 'https://accounts.google.com',
    email: 'user@example.com',
    emailVerified: true,
    username: 'oauth_user',
    name: 'Jane',
    surname: 'Doe',
    avatarUrl: null,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    scope: 'email profile',
    ...overrides,
  };
}

function makeCompleteBody(): OauthCompleteDTO {
  return {
    token: '11111111-1111-4111-8111-111111111111',
    username: 'fresh_user',
    birthdate: new Date('1995-05-05'),
    gender: 'other',
    nationality: 'french',
    userTheme: 'light',
  };
}

describe('OauthService', () => {
  const oauthFindUnique = jest.fn();
  const oauthUpsert = jest.fn();
  const userFindUnique = jest.fn();
  const userCreate = jest.fn();
  const prisma = {
    oauth: { findUnique: oauthFindUnique, upsert: oauthUpsert },
    user: { findUnique: userFindUnique, create: userCreate },
  } as unknown as PrismaService;

  const findByBanStatus = jest.fn();
  const users = { findByBanStatus } as unknown as UsersService;

  const setOauthPendingProfile = jest.fn();
  const getOauthPendingProfile = jest.fn();
  const deleteOauthPendingProfile = jest.fn();
  const redis = {
    setOauthPendingProfile,
    getOauthPendingProfile,
    deleteOauthPendingProfile,
  } as unknown as RedisService;

  const oauthLogin = jest.fn();
  const auth = { oauthLogin } as unknown as AuthService;

  const vault = {
    app: { frontend_url: 'https://front.test' },
  } as unknown as VaultService;

  const service = new OauthService(prisma, users, redis, auth, vault);

  beforeEach(() => jest.clearAllMocks());

  describe('handleLogin', () => {
    it('logs in the user attached to an existing oauth link', async () => {
      const user = makeUser();
      oauthFindUnique.mockResolvedValue({ user });
      findByBanStatus.mockResolvedValue(null);

      const result = await service.handleLogin(makeProfile());

      expect(result).toEqual({ status: 'user', user });
      expect(userFindUnique).not.toHaveBeenCalled();
      const [upsertArg] = oauthUpsert.mock.calls[0] as [
        { update: { accessToken: string } },
      ];
      expect(upsertArg.update).toMatchObject({ accessToken: 'access-token' });
    });

    it('attaches a verified oauth email to the existing account', async () => {
      const user = makeUser();
      oauthFindUnique.mockResolvedValue(null);
      userFindUnique.mockResolvedValue(user);
      findByBanStatus.mockResolvedValue(null);

      const result = await service.handleLogin(
        makeProfile({ emailVerified: true }),
      );

      expect(result).toEqual({ status: 'user', user });
      const [upsertArg] = oauthUpsert.mock.calls[0] as [
        { create: { userId: number } },
      ];
      expect(upsertArg.create).toMatchObject({ userId: 7 });
    });

    it('refuses to attach an unverified oauth email to the existing account', async () => {
      oauthFindUnique.mockResolvedValue(null);
      userFindUnique.mockResolvedValue(makeUser());

      const call = service.handleLogin(makeProfile({ emailVerified: false }));

      await expect(call).rejects.toThrow(ForbiddenException);
      await expect(call).rejects.toThrow(
        'An account with this email already exists.',
      );
      expect(oauthUpsert).not.toHaveBeenCalled();
      expect(setOauthPendingProfile).not.toHaveBeenCalled();
    });

    it('parks a brand new profile in redis as a pending signup', async () => {
      oauthFindUnique.mockResolvedValue(null);
      userFindUnique.mockResolvedValue(null);
      const profile = makeProfile();

      const result = await service.handleLogin(profile);

      const [token, serialized] = setOauthPendingProfile.mock.calls[0] as [
        string,
        string,
      ];
      expect(result).toEqual({ status: 'pending', token });
      expect(serialized).toBe(JSON.stringify(profile));
      expect(oauthUpsert).not.toHaveBeenCalled();
    });

    it('rejects a soft-deleted account', async () => {
      oauthFindUnique.mockResolvedValue({
        user: makeUser({ deletedAt: new Date() }),
      });

      await expect(service.handleLogin(makeProfile())).rejects.toThrow(
        'User is deleted.',
      );
      expect(oauthUpsert).not.toHaveBeenCalled();
    });

    it('rejects a banned account', async () => {
      oauthFindUnique.mockResolvedValue({ user: makeUser() });
      findByBanStatus.mockResolvedValue({ id: 3 });

      await expect(service.handleLogin(makeProfile())).rejects.toThrow(
        'User is banned.',
      );
      expect(oauthUpsert).not.toHaveBeenCalled();
    });
  });

  describe('handleCallback', () => {
    it('sends a pending signup to the completion page without opening a session', async () => {
      const res = {} as Response;

      await expect(
        service.handleCallback({ status: 'pending', token: 'tok-1' }, res),
      ).resolves.toBe('https://front.test/auth/complete-profile?signup=tok-1');
      expect(oauthLogin).not.toHaveBeenCalled();
    });

    it('opens a session for a known user and sends them to the frontend', async () => {
      const res = {} as Response;

      await expect(
        service.handleCallback({ status: 'user', user: makeUser() }, res),
      ).resolves.toBe('https://front.test');
      expect(oauthLogin).toHaveBeenCalledWith(7, res);
    });

    it('falls back to the frontend url when passport produced no result', async () => {
      const res = {} as Response;

      await expect(service.handleCallback(undefined, res)).resolves.toBe(
        'https://front.test',
      );
      expect(oauthLogin).not.toHaveBeenCalled();
    });
  });

  describe('getPendingProfile', () => {
    it('rejects an empty token without consulting redis', async () => {
      await expect(service.getPendingProfile('')).rejects.toThrow(
        'Signup session expired.',
      );
      expect(getOauthPendingProfile).not.toHaveBeenCalled();
    });

    it('rejects a token unknown to redis', async () => {
      getOauthPendingProfile.mockResolvedValue(null);

      await expect(service.getPendingProfile('gone-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('exposes only the public subset of the stored profile', async () => {
      getOauthPendingProfile.mockResolvedValue(JSON.stringify(makeProfile()));

      const pending = await service.getPendingProfile('tok-1');

      expect(pending).toEqual({
        email: 'user@example.com',
        username: 'oauth_user',
        name: 'Jane',
        surname: 'Doe',
        avatarUrl: null,
      });
    });
  });

  describe('completeSignup', () => {
    it('rejects a username that is already taken', async () => {
      getOauthPendingProfile.mockResolvedValue(JSON.stringify(makeProfile()));
      userFindUnique.mockResolvedValueOnce(makeUser());

      await expect(service.completeSignup(makeCompleteBody())).rejects.toThrow(
        ConflictException,
      );
      expect(userCreate).not.toHaveBeenCalled();
    });

    it('rejects an email that gained an account meanwhile', async () => {
      getOauthPendingProfile.mockResolvedValue(JSON.stringify(makeProfile()));
      userFindUnique.mockResolvedValueOnce(null);
      userFindUnique.mockResolvedValueOnce(makeUser());

      await expect(service.completeSignup(makeCompleteBody())).rejects.toThrow(
        'An account with this email already exists.',
      );
      expect(userCreate).not.toHaveBeenCalled();
    });

    it('creates a private pre-verified account, links oauth and purges the pending profile', async () => {
      getOauthPendingProfile.mockResolvedValue(JSON.stringify(makeProfile()));
      userFindUnique.mockResolvedValue(null);
      (hash as jest.MockedFunction<typeof hash>).mockResolvedValue(
        'random-hash',
      );
      userCreate.mockResolvedValue(makeUser({ id: 9 }));

      const user = await service.completeSignup(makeCompleteBody());

      const [createArg] = userCreate.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArg.data).toMatchObject({
        username: 'fresh_user',
        email: 'user@example.com',
        isEmailVerified: true,
        visibility: 'private',
      });
      const [upsertArg] = oauthUpsert.mock.calls[0] as [
        { create: { userId: number }; update: { expiresAt: Date } },
      ];
      expect(upsertArg.create).toMatchObject({ userId: 9 });
      expect(upsertArg.update.expiresAt).toBeInstanceOf(Date);
      expect(upsertArg.update.expiresAt).toEqual(
        new Date('2030-01-01T00:00:00.000Z'),
      );
      expect(deleteOauthPendingProfile).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
      );
      expect(user).toMatchObject({ id: 9 });
    });
  });
});
