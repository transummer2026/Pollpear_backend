import { ForbiddenException } from '@nestjs/common';
import { ForbiddenError } from '@casl/ability';
import { ApiMeService } from './me.service';
import { MeService } from 'src/me/me.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import type { User } from 'src/generated/prisma/client';
import {
  ApiMeSchema,
  ApiMeUpdateSchema,
  type ApiMeUpdateDTO,
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

function makeViewer(overrides: Partial<User> = {}): User {
  return {
    ...user,
    id: OWNER_ID,
    passwordHash: 'hash',
    deletedAt: null,
    ...overrides,
  } as User;
}

function abilityFor(viewer: User) {
  return new CaslAbilityFactory().createForUser(viewer);
}

type MeQuery = { where: object; select: Record<string, true>; data?: object };

describe('ApiMeService', () => {
  let service: ApiMeService;
  const findFirst = jest.fn<Promise<unknown>, [MeQuery]>();
  const update = jest.fn<Promise<unknown>, [MeQuery]>();
  const remove = jest.fn<Promise<unknown>, [number]>();
  const viewer = makeViewer();

  beforeEach(() => {
    findFirst.mockReset();
    update.mockReset();
    remove.mockReset();
    service = new ApiMeService(
      { user: { findFirst, update } } as unknown as PrismaService,
      { remove } as unknown as MeService,
      new CaslAbilityFactory(),
    );
  });

  it('returns the owner profile in the public shape', async () => {
    findFirst.mockResolvedValue(user);

    await expect(service.findMe(viewer)).resolves.toEqual({
      ...user,
      avatarUrl: null,
      bannerUrl: null,
    });
  });

  it('reports a built-in placeholder as no image, never as a path', async () => {
    findFirst.mockResolvedValue(user);

    const me = await service.findMe(viewer);

    expect(me.avatarUrl).toBeNull();
    expect(me.bannerUrl).toBeNull();
  });

  it('hands back an uploaded image as an absolute url', async () => {
    const uploaded = 'https://cdn.pollpear.com/uploads/avatars/1.webp?v=2';
    findFirst.mockResolvedValue({ ...user, avatarUrl: uploaded });

    const me = await service.findMe(viewer);

    expect(me.avatarUrl).toBe(uploaded);
    expect(me.bannerUrl).toBeNull();
  });

  it('never selects a column the contract does not promise', async () => {
    findFirst.mockResolvedValue(user);
    await service.findMe(viewer);

    const { select } = findFirst.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual(
      Object.keys(ApiMeSchema.shape).sort(),
    );
  });

  /**
   * The scope is the CASL read policy itself, not a copy of it: the query
   * has to carry what `accessibleBy` produces, so a rule added upstream
   * reaches the public api without anyone editing this service.
   */
  it('scopes the read to what the User policy allows', async () => {
    findFirst.mockResolvedValue(user);
    await service.findMe(viewer);

    const { where } = findFirst.mock.calls[0][0];
    expect(where).toEqual({
      AND: [
        accessibleBy(abilityFor(viewer), 'read').ofType('User'),
        { id: OWNER_ID },
      ],
    });
  });

  it('never filters soft deleted owners by hand', async () => {
    findFirst.mockResolvedValue(user);
    await service.findMe(viewer);

    const { where } = findFirst.mock.calls[0][0];
    expect(JSON.stringify(where)).toContain('deletedAt');
    expect(where).not.toHaveProperty('deletedAt');
  });

  it('refuses a read the policy denies', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.findMe(viewer)).rejects.toThrow(ForbiddenException);
  });

  it('writes only the fields sent, and reads back the public shape', async () => {
    update.mockResolvedValue({ ...user, bio: 'hello' });

    await service.updateMe(viewer, { bio: 'hello' });

    expect(update.mock.calls[0][0]).toEqual({
      where: {
        id: OWNER_ID,
        AND: [accessibleBy(abilityFor(viewer), 'update').ofType('User')],
      },
      data: { bio: 'hello' },
      select: expect.objectContaining({ username: true }) as unknown,
    });
  });

  /**
   * `role` is already out of the body schema. This asserts the second
   * lock: the policy is asked field by field, so the day a column becomes
   * editable upstream it is CASL that decides, not the shape of the DTO.
   */
  it('refuses a field the policy keeps read-only', async () => {
    const body = { role: 'admin' } as unknown as ApiMeUpdateDTO;

    await expect(service.updateMe(viewer, body)).rejects.toThrow(
      ForbiddenError,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a write from an account the policy has closed', async () => {
    const closed = makeViewer({ deletedAt: new Date('2026-02-01') });

    await expect(service.updateMe(closed, { bio: 'hello' })).rejects.toThrow(
      ForbiddenError,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('delegates deletion to the account lifecycle', async () => {
    remove.mockResolvedValue(undefined);

    await expect(service.deleteMe(viewer)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(OWNER_ID);
  });

  it('refuses to delete an account already closed', async () => {
    const closed = makeViewer({ deletedAt: new Date('2026-02-01') });

    await expect(service.deleteMe(closed)).rejects.toThrow(ForbiddenError);
    expect(remove).not.toHaveBeenCalled();
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
