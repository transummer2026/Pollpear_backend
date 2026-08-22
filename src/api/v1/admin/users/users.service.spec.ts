import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiAdminUserService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MeService } from 'src/me/me.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import type { User } from 'src/generated/prisma/client';
import {
  ApiAdminUserColumnsSchema,
  ApiModerationUserColumnsSchema,
  type ApiAdminUserDTO,
} from '../../common/schemas/api-admin.schema';

const columns = {
  id: 5,
  username: 'moderator4',
  name: null,
  surname: null,
  email: 'mod@pollpear.com',
  birthdate: new Date('1990-01-01'),
  role: 'moderator',
  gender: 'other',
  nationality: 'French',
  city: null,
  state: null,
  country: null,
  company: null,
  bio: null,
  score: 170,
  isOnline: false,
  isEmailVerified: true,
  visibility: 'public',
  lastSeenAt: null,
  avatarUrl: '/uploads/avatars/default.svg',
  bannerUrl: '/uploads/banners/default.svg',
  userTheme: 'light',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
};

const totals = {
  pollsCreated: 3,
  roomsCreated: 2,
  votes: 10,
  messages: 4,
  bansReceived: 2,
  reportsGiven: 0,
  reportsReceived: 1,
  apiKeys: 5,
};

const admin = { id: 1, role: 'admin' } as unknown as User;
const moderator = { id: 2, role: 'moderator' } as unknown as User;

describe('ApiAdminUserService', () => {
  let service: ApiAdminUserService;
  const findUnique = jest.fn<
    Promise<unknown>,
    [{ where: object; select: object }]
  >();
  const update = jest.fn();
  const remove = jest.fn();
  const transaction = jest.fn<Promise<unknown[]>, [unknown[]]>();
  const count = () => jest.fn();

  beforeEach(async () => {
    [findUnique, update, remove, transaction].forEach((fn) => fn.mockReset());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiAdminUserService,
        CaslAbilityFactory,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique, update },
            poll: { count: count() },
            room: { count: count() },
            vote: { count: count() },
            message: { count: count() },
            ban: { count: count() },
            apiKey: { count: count() },
            $transaction: transaction,
          },
        },
        { provide: MeService, useValue: { remove } },
      ],
    }).compile();

    service = module.get<ApiAdminUserService>(ApiAdminUserService);
  });

  /**
   * What is still live beside the lifetime totals: polls 2/3, rooms 2/2,
   * votes 9/10, messages 4/4, bans 0 active and 2 lifted of 2, keys 0 active
   * and 5 revoked of 5. Lifted and revoked are answers of their own here, not
   * remainders, which is exactly what the service must not deduce.
   */
  const LIVE = {
    polls: 2,
    rooms: 2,
    votes: 9,
    messages: 4,
    bansActive: 0,
    bansLifted: 2,
    keysActive: 0,
    keysRevoked: 5,
  };

  const answer = (
    who: 'admin' | 'moderator',
    over: Partial<typeof LIVE> = {},
    row: Record<string, unknown> = columns,
  ) => {
    const live = { ...LIVE, ...over };
    const user = { ...row, _count: totals };
    findUnique.mockResolvedValue(user);
    transaction.mockResolvedValue([
      user,
      live.polls,
      live.rooms,
      live.votes,
      live.messages,
      live.bansActive,
      live.bansLifted,
      ...(who === 'admin' ? [live.keysActive, live.keysRevoked] : []),
    ]);
  };

  const answerAdmin = (over: Partial<typeof LIVE> = {}) =>
    answer('admin', over);
  const answerModerator = () => answer('moderator');

  it('pairs every total with what is still live', async () => {
    answerAdmin();

    const record = await service.findOneUser(5, admin);

    expect(record.counts).toEqual({
      pollsCreated: { total: 3, active: 2, deleted: 1 },
      roomsCreated: { total: 2, active: 2, deleted: 0 },
      votes: { total: 10, active: 9, deleted: 1 },
      messages: { total: 4, active: 4, deleted: 0 },
      bansReceived: { total: 2, active: 0, lifted: 2 },
      reportsGiven: 0,
      reportsReceived: 1,
      apiKeys: { total: 5, active: 0, revoked: 5 },
    });
  });

  it('never reports a ban that ran its course as one somebody lifted', async () => {
    answerAdmin({ bansActive: 1, bansLifted: 0 });

    const record = await service.findOneUser(5, admin);

    expect(record.counts.bansReceived).toEqual({
      total: 2,
      active: 1,
      lifted: 0,
    });
  });

  it('never reports an expired key as a revoked one', async () => {
    answerAdmin({ keysActive: 1, keysRevoked: 1 });

    const record = (await service.findOneUser(5, admin)) as ApiAdminUserDTO;

    expect(record.counts.apiKeys).toEqual({ total: 5, active: 1, revoked: 1 });
  });

  it('costs an admin nine statements, in one round trip', async () => {
    answerAdmin();

    await service.findOneUser(5, admin);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][0]).toHaveLength(9);
    const { select } = findUnique.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(Object.keys(select).sort()).toEqual(
      [...Object.keys(ApiAdminUserColumnsSchema.shape), '_count'].sort(),
    );
  });

  it('costs a moderator two statements less, and reads fewer columns', async () => {
    answerModerator();

    await service.findOneUser(5, moderator);

    expect(transaction.mock.calls[0][0]).toHaveLength(7);
    const { select } = findUnique.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(Object.keys(select).sort()).toEqual(
      [...Object.keys(ApiModerationUserColumnsSchema.shape), '_count'].sort(),
    );
  });

  it('never hands a moderator the identity, contact details or keys', async () => {
    answerModerator();

    const record = await service.findOneUser(5, moderator);

    for (const hidden of ['email', 'birthdate', 'name', 'surname', 'city']) {
      expect(record).not.toHaveProperty(hidden);
    }
    expect(record.counts).not.toHaveProperty('apiKeys');
  });

  it('sees a deleted account, unlike the public routes', async () => {
    const deleted = { ...columns, deletedAt: new Date('2026-02-01') };
    answer('admin', {}, deleted);

    const record = await service.findOneUser(5, admin);

    expect(record.deletedAt).toEqual(new Date('2026-02-01'));
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: 5 });
  });

  it('answers 404 for an account that does not exist', async () => {
    findUnique.mockResolvedValue(null);
    transaction.mockResolvedValue([null, 0, 0, 0, 0, 0, 0, 0, 0]);

    await expect(service.findOneUser(5, admin)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes through the account lifecycle so keys are revoked', async () => {
    remove.mockResolvedValue(undefined);

    await service.removeUser(5, admin);

    expect(remove).toHaveBeenCalledWith(5);
  });

  describe('updateUser', () => {
    it('lets an admin change role and deletedAt, and hands back the admin record', async () => {
      update.mockResolvedValue(undefined);
      answerAdmin();

      const record = await service.updateUser(
        5,
        { role: 'admin', deletedAt: null },
        admin,
      );

      expect(update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { role: 'admin', deletedAt: null },
      });
      expect(record.counts).toHaveProperty('apiKeys');
    });

    it('lets a moderator change visibility and isEmailVerified, and hands back the moderation record', async () => {
      update.mockResolvedValue(undefined);
      answerModerator();

      const record = await service.updateUser(
        5,
        { visibility: 'private', isEmailVerified: false },
        moderator,
      );

      expect(update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { visibility: 'private', isEmailVerified: false },
      });
      expect(record.counts).not.toHaveProperty('apiKeys');
    });

    it('refuses a moderator touching role or deletedAt, without writing anything', async () => {
      await expect(
        service.updateUser(5, { role: 'admin' }, moderator),
      ).rejects.toThrow(ForbiddenException);

      expect(update).not.toHaveBeenCalled();
    });

    it('names every forbidden field when a moderator mixes both tiers', async () => {
      await expect(
        service.updateUser(
          5,
          { visibility: 'private', role: 'admin', deletedAt: null },
          moderator,
        ),
      ).rejects.toThrow('Not allowed to change: role, deletedAt');
    });
  });
});
