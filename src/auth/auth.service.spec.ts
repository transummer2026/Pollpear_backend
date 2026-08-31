import { Logger, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { type Response } from 'express';
import { type PasswordResetDTO } from 'Pollpear_shared/src/schemas/auth.schema';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { BanService } from 'src/ban/ban.service';
import { VaultService } from 'src/vault/vault.service';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
import { RevocationService } from 'src/revocation/revocation.service';
import { AuthService } from './auth.service';

jest.mock('argon2');

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

function makeResponse() {
  const cookie = jest.fn();
  return { response: { cookie } as unknown as Response, cookie };
}

describe('AuthService', () => {
  const hashMock = hash as jest.MockedFunction<typeof hash>;
  const verifyMock = verify as jest.MockedFunction<typeof verify>;

  const findByEmail = jest.fn();
  const generateSessionId = jest.fn();
  const updatePassword = jest.fn();
  const markEmailVerified = jest.fn();
  const users = {
    findByEmail,
    generateSessionId,
    updatePassword,
    verifyEmail: markEmailVerified,
  } as unknown as UsersService;

  const findByBanStatus = jest.fn();
  const ban = { findByBanStatus } as unknown as BanService;

  const setRedisCache = jest.fn();
  const setPasswordResetToken = jest.fn();
  const getPasswordResetToken = jest.fn();
  const deletePasswordResetToken = jest.fn();
  const setEmailVerifyToken = jest.fn();
  const getEmailVerifyToken = jest.fn();
  const deleteEmailVerifyToken = jest.fn();
  const redis = {
    setRedisCache,
    setPasswordResetToken,
    getPasswordResetToken,
    deletePasswordResetToken,
    setEmailVerifyToken,
    getEmailVerifyToken,
    deleteEmailVerifyToken,
  } as unknown as RedisService;

  const sendPasswordResetEmail = jest.fn();
  const sendVerificationEmail = jest.fn();
  const mail = {
    sendPasswordResetEmail,
    sendVerificationEmail,
  } as unknown as MailService;

  const revokeUser = jest.fn();
  const emitter = { revokeUser } as unknown as WebsocketEmitter;

  const revocation = {
    revokeAllSessions: jest.fn(),
  } as unknown as RevocationService;

  const prisma = {} as PrismaService;
  const vault = {
    session: { pepper: 'test-pepper' },
    app: { frontend_url: 'https://front.test' },
  } as unknown as VaultService;

  const service = new AuthService(
    prisma,
    users,
    ban,
    redis,
    mail,
    vault,
    emitter,
    revocation,
  );

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => jest.clearAllMocks());

  describe('constructor', () => {
    it('refuses to start when the session pepper is missing', () => {
      const emptyVault = { session: {} } as unknown as VaultService;

      expect(
        () =>
          new AuthService(
            prisma,
            users,
            ban,
            redis,
            mail,
            emptyVault,
            emitter,
            revocation,
          ),
      ).toThrow('Vault pepper secret is not defined');
    });
  });

  describe('login', () => {
    const body = { email: 'user@example.com', password: 'secret-password' };

    it('still runs the password verifier for an unknown email', async () => {
      findByEmail.mockResolvedValue(null);
      verifyMock.mockResolvedValue(false);

      await expect(
        service.login(body, makeResponse().response),
      ).rejects.toThrow(UnauthorizedException);
      expect(verifyMock).toHaveBeenCalledTimes(1);
      expect(verifyMock.mock.calls[0][0]).toMatch(/^\$argon2id\$/);
    });

    it('rejects a wrong password without ever checking bans', async () => {
      findByEmail.mockResolvedValue(makeUser());
      verifyMock.mockResolvedValue(false);

      await expect(
        service.login(body, makeResponse().response),
      ).rejects.toThrow(UnauthorizedException);
      expect(verifyMock).toHaveBeenCalledWith(
        'stored-hash',
        'secret-password',
        expect.objectContaining({ secret: Buffer.from('test-pepper') }),
      );
      expect(findByBanStatus).not.toHaveBeenCalled();
    });

    it('rejects a banned user even with valid credentials', async () => {
      findByEmail.mockResolvedValue(makeUser());
      verifyMock.mockResolvedValue(true);
      findByBanStatus.mockResolvedValue({ id: 1 });

      await expect(
        service.login(body, makeResponse().response),
      ).rejects.toThrow('User is banned.');
    });

    it('rejects a soft-deleted user', async () => {
      findByEmail.mockResolvedValue(makeUser({ deletedAt: new Date() }));
      verifyMock.mockResolvedValue(true);
      findByBanStatus.mockResolvedValue(null);

      await expect(
        service.login(body, makeResponse().response),
      ).rejects.toThrow('User is deleted.');
    });

    it('rejects an unverified email without opening a session', async () => {
      findByEmail.mockResolvedValue(makeUser({ isEmailVerified: false }));
      verifyMock.mockResolvedValue(true);
      findByBanStatus.mockResolvedValue(null);

      await expect(
        service.login(body, makeResponse().response),
      ).rejects.toThrow('Email not verified.');
      expect(setRedisCache).not.toHaveBeenCalled();
    });

    it('opens a redis session and sets the sid cookie on success', async () => {
      findByEmail.mockResolvedValue(makeUser());
      verifyMock.mockResolvedValue(true);
      findByBanStatus.mockResolvedValue(null);
      generateSessionId.mockReturnValue('session-1');
      const { response, cookie } = makeResponse();

      const result = await service.login(body, response);

      expect(setRedisCache).toHaveBeenCalledWith('session-1', 7);
      expect(cookie).toHaveBeenCalledWith(
        'sid',
        'session-1',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(result).toMatchObject({ id: 7, email: 'user@example.com' });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('passwordForgot', () => {
    it('stays silent on an unknown email', async () => {
      findByEmail.mockResolvedValue(null);

      service.passwordForgot({ email: 'ghost@example.com' });
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(setPasswordResetToken).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('stores a reset token and mails the matching link', async () => {
      findByEmail.mockResolvedValue(makeUser());

      service.passwordForgot({ email: 'user@example.com' });
      await new Promise<void>((resolve) => setImmediate(resolve));

      const [token, userId] = setPasswordResetToken.mock.calls[0] as [
        string,
        number,
      ];
      expect(userId).toBe(7);
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        `https://front.test/auth/change-password?token=${token}`,
      );
    });

    it('swallows a mail delivery failure instead of surfacing it', async () => {
      findByEmail.mockResolvedValue(makeUser());
      sendPasswordResetEmail.mockRejectedValue(new Error('smtp down'));

      expect(() =>
        service.passwordForgot({ email: 'user@example.com' }),
      ).not.toThrow();
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(sendPasswordResetEmail).toHaveBeenCalled();
    });
  });

  describe('passwordReset', () => {
    const body: PasswordResetDTO = {
      token: 'reset-token',
      password: 'NewPassword12345',
      confirmPassword: 'NewPassword12345',
    };

    it('rejects an invalid or expired token', async () => {
      getPasswordResetToken.mockResolvedValue(null);

      await expect(service.passwordReset(body)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(updatePassword).not.toHaveBeenCalled();
    });

    it('rehashes the password and burns the token', async () => {
      getPasswordResetToken.mockResolvedValue(7);
      hashMock.mockResolvedValue('new-hash');

      await service.passwordReset(body);

      expect(updatePassword).toHaveBeenCalledWith(7, 'new-hash');
      expect(deletePasswordResetToken).toHaveBeenCalledWith('reset-token', 7);
    });
  });

  describe('verifyEmail', () => {
    it('rejects an invalid or expired token', async () => {
      getEmailVerifyToken.mockResolvedValue(null);

      await expect(service.verifyEmail({ token: 'bad-token' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(markEmailVerified).not.toHaveBeenCalled();
    });

    it('marks the email verified and burns the token', async () => {
      getEmailVerifyToken.mockResolvedValue(7);

      await service.verifyEmail({ token: 'verify-token' });

      expect(markEmailVerified).toHaveBeenCalledWith(7);
      expect(deleteEmailVerifyToken).toHaveBeenCalledWith('verify-token', 7);
    });
  });

  describe('resendVerification', () => {
    it('stays silent on an unknown email', async () => {
      findByEmail.mockResolvedValue(null);

      await service.resendVerification({ email: 'ghost@example.com' });

      expect(setEmailVerifyToken).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('stays silent when the email is already verified', async () => {
      findByEmail.mockResolvedValue(makeUser({ isEmailVerified: true }));

      await service.resendVerification({ email: 'user@example.com' });

      expect(setEmailVerifyToken).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('stores a fresh token and mails the verification link', async () => {
      findByEmail.mockResolvedValue(makeUser({ isEmailVerified: false }));

      await service.resendVerification({ email: 'user@example.com' });

      const [token, userId] = setEmailVerifyToken.mock.calls[0] as [
        string,
        number,
      ];
      expect(userId).toBe(7);
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        'user@example.com',
        `https://front.test/auth/verify-email?token=${token}`,
      );
    });
  });

  describe('logout', () => {
    it('revokes the websocket tunnels of the user', async () => {
      await service.logout(7);

      expect(revokeUser).toHaveBeenCalledWith(7);
    });
  });
});
