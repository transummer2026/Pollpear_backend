import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { ApiMeService } from './me.service';
import { MeService } from 'src/me/me.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ApiMeSchema,
  ApiMeUpdateSchema,
} from '../common/schemas/api-me.schema';

const OWNER_ID = 1;

const user = {
  username: 'pollpear',
  name: null,
  surname: null,
  email: 'owner@pollpear.com',
  birthdate: new Date('1990-01-01'),
  role: 'user',
  gender: 'other',
  nationality: 'French',
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
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

type MeQuery = { where: object; select: Record<string, true>; data?: object };

describe('ApiMeService', () => {
  let service: ApiMeService;
  const findFirst = jest.fn<Promise<unknown>, [MeQuery]>();
  const update = jest.fn<Promise<unknown>, [MeQuery]>();
  const remove = jest.fn<Promise<unknown>, [number]>();

  beforeEach(async () => {
    findFirst.mockReset();
    update.mockReset();
    remove.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiMeService,
        { provide: PrismaService, useValue: { user: { findFirst, update } } },
        { provide: MeService, useValue: { remove } },
      ],
    }).compile();

    service = module.get<ApiMeService>(ApiMeService);
  });

  it('returns the owner profile in the public shape', async () => {
    findFirst.mockResolvedValue(user);

    await expect(service.findMe(OWNER_ID)).resolves.toEqual({
      ...user,
      avatarUrl: null,
      bannerUrl: null,
    });
  });

  it('reports a built-in placeholder as no image, never as a path', async () => {
    findFirst.mockResolvedValue(user);

    const me = await service.findMe(OWNER_ID);

    expect(me.avatarUrl).toBeNull();
    expect(me.bannerUrl).toBeNull();
  });

  it('hands back an uploaded image as an absolute url', async () => {
    const uploaded = 'https://cdn.pollpear.com/uploads/avatars/1.webp?v=2';
    findFirst.mockResolvedValue({ ...user, avatarUrl: uploaded });

    const me = await service.findMe(OWNER_ID);

    expect(me.avatarUrl).toBe(uploaded);
    expect(me.bannerUrl).toBeNull();
  });

  it('never selects a column the contract does not promise', async () => {
    findFirst.mockResolvedValue(user);
    await service.findMe(OWNER_ID);

    const { select } = findFirst.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual(
      Object.keys(ApiMeSchema.shape).sort(),
    );
  });

  it('skips soft deleted owners', async () => {
    findFirst.mockResolvedValue(user);
    await service.findMe(OWNER_ID);

    const { where } = findFirst.mock.calls[0][0];
    expect(where).toEqual({ id: OWNER_ID, deletedAt: null });
  });

  it('rejects a key whose owner is gone', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.findMe(OWNER_ID)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('writes only the fields sent, and reads back the public shape', async () => {
    update.mockResolvedValue({ ...user, bio: 'hello' });

    await service.updateMe(OWNER_ID, { bio: 'hello' });

    expect(update.mock.calls[0][0]).toEqual({
      where: { id: OWNER_ID, deletedAt: null },
      data: { bio: 'hello' },
      select: expect.objectContaining({ username: true }) as unknown,
    });
  });

  it('rejects an edit from a key whose owner is gone, like a read', async () => {
    update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '0.0.0',
      }),
    );

    await expect(service.updateMe(OWNER_ID, { bio: 'hello' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lets any other database error through, untranslated', async () => {
    update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Value too long', {
        code: 'P2000',
        clientVersion: '0.0.0',
      }),
    );

    await expect(service.updateMe(OWNER_ID, { bio: 'hello' })).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it('delegates deletion to the account lifecycle', async () => {
    remove.mockResolvedValue(undefined);

    await expect(service.deleteMe(OWNER_ID)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(OWNER_ID);
  });
});

describe('ApiMeUpdateSchema', () => {
  it('refuses a field the api does not expose', () => {
    expect(ApiMeUpdateSchema.safeParse({ role: 'admin' }).success).toBe(false);
  });

  it('refuses an empty body', () => {
    expect(ApiMeUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('refuses a value the column cannot hold', () => {
    const bio = 'x'.repeat(256);
    expect(ApiMeUpdateSchema.safeParse({ bio }).success).toBe(false);
  });

  it('accepts null to clear an optional field', () => {
    expect(ApiMeUpdateSchema.safeParse({ bio: null }).success).toBe(true);
  });
});
