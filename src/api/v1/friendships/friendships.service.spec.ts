import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiFriendshipsService } from './friendships.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { NotificationService } from 'src/notification/notification.service';
import { accessibleBy } from 'src/casl/casl-prisma';
import type { User } from 'src/generated/prisma/client';

const anna = { id: 4, role: 'user' } as unknown as User;
const BOB = 9;

const summaries = {
  userA: { id: 4, username: 'anna' },
  userB: { id: 9, username: 'bob' },
};

/** canonicalPair(4, 9) range anna en A et bob en B. */
const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  status: 'pending',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  userAId: 4,
  userBId: 9,
  addresseeId: BOB,
  ...summaries,
  ...over,
});

const page = { page: 1, limit: 20 };

type Queried = { where: Record<string, unknown>; skip?: number; take?: number };

describe('ApiFriendshipsService', () => {
  let service: ApiFriendshipsService;
  const findMany = jest.fn<Promise<unknown>, [Queried]>();
  const count = jest.fn();
  const findFirst = jest.fn<Promise<unknown>, [Queried]>();
  const findUnique = jest.fn<Promise<unknown>, [{ where: object }]>();
  const upsert = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
  const update = jest.fn<Promise<unknown>, [{ data: object }]>();
  const updateMany = jest.fn<Promise<{ count: number }>, [{ where: object }]>();
  const userFindFirst = jest.fn<Promise<unknown>, [{ where: object }]>();
  const transaction = jest.fn<Promise<unknown[]>, [unknown[]]>();

  const notifyFriendRequest = jest.fn();
  const notifyFriendAccepted = jest.fn();
  const clearFriendRequest = jest.fn();
  const clearFriendNotifications = jest.fn();

  beforeEach(async () => {
    [
      findMany,
      count,
      findFirst,
      findUnique,
      upsert,
      update,
      updateMany,
      userFindFirst,
      transaction,
      notifyFriendRequest,
      notifyFriendAccepted,
      clearFriendRequest,
      clearFriendNotifications,
    ].forEach((fn) => fn.mockReset());
    userFindFirst.mockResolvedValue({ id: BOB });
    updateMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiFriendshipsService,
        CaslAbilityFactory,
        {
          provide: PrismaService,
          useValue: {
            friendship: {
              findMany,
              count,
              findFirst,
              findUnique,
              upsert,
              update,
              updateMany,
            },
            user: { findFirst: userFindFirst },
            $transaction: transaction,
          },
        },
        {
          provide: NotificationService,
          useValue: {
            notifyFriendRequest,
            notifyFriendAccepted,
            clearFriendRequest,
            clearFriendNotifications,
          },
        },
      ],
    }).compile();

    service = module.get<ApiFriendshipsService>(ApiFriendshipsService);
  });

  describe('findAllFriendships', () => {
    it('names the two parties by their role, and hides the stored pair', async () => {
      transaction.mockResolvedValue([[row()], 1]);

      const answer = await service.findAllFriendships(page, anna);

      expect(answer.data[0]).toEqual({
        id: 1,
        status: 'pending',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        requester: summaries.userA,
        addressee: summaries.userB,
      });
    });

    it('scopes the list with the Friendship policy, never a hand-written filter', async () => {
      transaction.mockResolvedValue([[], 0]);

      await service.findAllFriendships(page, anna);

      expect(findMany.mock.calls[0][0].where).toEqual({
        AND: [
          accessibleBy(
            new CaslAbilityFactory().createForUser(anna),
            'read',
          ).ofType('Friendship'),
          {},
        ],
      });
    });

    it('refuses a page larger than the caller role allows', async () => {
      await expect(
        service.findAllFriendships({ page: 1, limit: 51 }, anna),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    });
  });

  describe('findOneFriendship', () => {
    it('404s one the caller may not see, exactly like a missing one', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.findOneFriendship(1, anna)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createFriendship', () => {
    it('400s befriending yourself, before touching anything', async () => {
      await expect(
        service.createFriendship({ addresseeId: anna.id }, anna),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userFindFirst).not.toHaveBeenCalled();
    });

    it('asks the policy whether the account may be approached at all', async () => {
      findUnique.mockResolvedValue(null);
      upsert.mockResolvedValue(row());

      await service.createFriendship({ addresseeId: BOB }, anna);

      expect(userFindFirst.mock.calls[0][0].where).toEqual({
        AND: [
          accessibleBy(
            new CaslAbilityFactory().createForUser(anna),
            'interact',
          ).ofType('User'),
          { id: BOB, deletedAt: null },
        ],
      });
    });

    it('403s an account the policy keeps out of reach', async () => {
      userFindFirst.mockResolvedValue(null);

      await expect(
        service.createFriendship({ addresseeId: BOB }, anna),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(upsert).not.toHaveBeenCalled();
    });

    it('opens a pending request on the canonical pair, and tells the addressee', async () => {
      findUnique.mockResolvedValue(null);
      upsert.mockResolvedValue(row());

      await service.createFriendship({ addresseeId: BOB }, anna);

      expect(upsert.mock.calls[0][0]).toMatchObject({
        where: { userAId_userBId: { userAId: 4, userBId: 9 } },
        create: { userAId: 4, userBId: 9, addresseeId: BOB, status: 'pending' },
      });
      expect(notifyFriendRequest).toHaveBeenCalledWith(BOB, anna.id);
    });

    it('accepts their request rather than opening a facing one', async () => {
      findUnique.mockResolvedValue(row({ addresseeId: anna.id }));
      findUnique.mockResolvedValueOnce(row({ addresseeId: anna.id }));
      findUnique.mockResolvedValue(
        row({ addresseeId: anna.id, status: 'accepted' }),
      );

      const answer = await service.createFriendship({ addresseeId: BOB }, anna);

      expect(updateMany.mock.calls[0][0].where).toMatchObject({
        id: 1,
        status: 'pending',
      });
      expect(notifyFriendAccepted).toHaveBeenCalledWith(BOB, anna.id);
      expect(upsert).not.toHaveBeenCalled();
      expect(answer.status).toBe('accepted');
    });

    it('409s a friendship that already stands', async () => {
      findUnique.mockResolvedValue(row({ status: 'accepted' }));

      await expect(
        service.createFriendship({ addresseeId: BOB }, anna),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('says nothing new when the caller asks twice', async () => {
      findUnique.mockResolvedValue(row());

      await service.createFriendship({ addresseeId: BOB }, anna);

      expect(upsert).not.toHaveBeenCalled();
      expect(notifyFriendRequest).not.toHaveBeenCalled();
    });

    it('reopens a friendship that was refused or withdrawn', async () => {
      findUnique.mockResolvedValue(row({ status: 'rejected' }));
      upsert.mockResolvedValue(row());

      await service.createFriendship({ addresseeId: BOB }, anna);

      expect(upsert.mock.calls[0][0]).toMatchObject({
        update: { status: 'pending', deletedAt: null, addresseeId: BOB },
      });
      expect(notifyFriendRequest).toHaveBeenCalled();
    });
  });

  describe('updateFriendship', () => {
    const forAnna = row({ addresseeId: anna.id });

    it('lets the addressee accept, and tells the requester', async () => {
      findFirst.mockResolvedValue(forAnna);
      update.mockResolvedValue({ ...forAnna, status: 'accepted' });

      await service.updateFriendship(1, { status: 'accepted' }, anna);

      expect(update.mock.calls[0][0].data).toEqual({ status: 'accepted' });
      expect(notifyFriendAccepted).toHaveBeenCalledWith(BOB, anna.id);
    });

    it('tells nobody it was accepted when it was refused', async () => {
      findFirst.mockResolvedValue(forAnna);
      update.mockResolvedValue({ ...forAnna, status: 'rejected' });

      await service.updateFriendship(1, { status: 'rejected' }, anna);

      expect(notifyFriendAccepted).not.toHaveBeenCalled();
      expect(clearFriendRequest).toHaveBeenCalledWith(anna.id, BOB);
    });

    it('403s the requester answering on their own behalf', async () => {
      findFirst.mockResolvedValue(row());

      await expect(
        service.updateFriendship(1, { status: 'accepted' }, anna),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(update).not.toHaveBeenCalled();
    });

    it('403s a request that was already answered', async () => {
      findFirst.mockResolvedValue(
        row({ addresseeId: anna.id, status: 'accepted' }),
      );

      await expect(
        service.updateFriendship(1, { status: 'rejected' }, anna),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('removeFriendship', () => {
    it('soft deletes, and clears what was said on both sides', async () => {
      findFirst.mockResolvedValue(row());
      update.mockResolvedValue(row({ deletedAt: new Date() }));

      await service.removeFriendship(1, anna);

      expect(update.mock.calls[0][0].data).toEqual({
        deletedAt: expect.any(Date) as Date,
      });
      expect(clearFriendNotifications).toHaveBeenCalledWith(BOB, anna.id);
      expect(clearFriendNotifications).toHaveBeenCalledWith(anna.id, BOB);
    });

    it('403s somebody who is not a party to it', async () => {
      findFirst.mockResolvedValue(row({ userAId: 7, userBId: 8 }));

      await expect(service.removeFriendship(1, anna)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(update).not.toHaveBeenCalled();
    });

    it('404s one already withdrawn, which the policy stops showing', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.removeFriendship(1, anna)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(update).not.toHaveBeenCalled();
    });
  });
});
