import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ForbiddenError } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { NotificationService } from 'src/notification/notification.service';
import type { User } from 'src/generated/prisma/client';
import { BlockService } from './block.service';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    username: 'alice',
    role: 'user',
    ...overrides,
  };
}

/** A full-shaped `User` for a given id — what `@CurrentUser()` now hands
 * the service, in place of a bare id. */
function viewer(id: number): User {
  return makeUser({ id }) as User;
}

function makeBlock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 20,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    blockerId: 1,
    blockedId: 2,
    ...overrides,
  };
}

type FindManyArgs = {
  where: Record<string, unknown>;
  include: Record<string, unknown>;
};
type UpdateManyArgs = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};
type BlockUniqueArgs = {
  where: { blockerId_blockedId: { blockerId: number; blockedId: number } };
};
type BlockCreateArgs = { data: Record<string, unknown> };
type BlockDeleteArgs = { where: { id: number } };

describe('BlockService', () => {
  let service: BlockService;
  let notifications: {
    notify: jest.Mock;
    clearFriendRequest: jest.Mock;
    clearFriendNotifications: jest.Mock;
  };
  let prisma: {
    friendship: {
      updateMany: jest.Mock<Promise<unknown>, [UpdateManyArgs]>;
    };
    block: {
      findUnique: jest.Mock<Promise<unknown>, [BlockUniqueArgs]>;
      findMany: jest.Mock<Promise<unknown[]>, [FindManyArgs]>;
      create: jest.Mock<Promise<unknown>, [BlockCreateArgs]>;
      delete: jest.Mock<Promise<unknown>, [BlockDeleteArgs]>;
    };
    $transaction: jest.Mock<Promise<unknown[]>, [Promise<unknown>[]]>;
  };

  beforeEach(() => {
    prisma = {
      friendship: {
        updateMany: jest.fn<Promise<unknown>, [UpdateManyArgs]>(),
      },
      block: {
        findUnique: jest.fn<Promise<unknown>, [BlockUniqueArgs]>(),
        findMany: jest.fn<Promise<unknown[]>, [FindManyArgs]>(),
        create: jest.fn<Promise<unknown>, [BlockCreateArgs]>(),
        delete: jest.fn<Promise<unknown>, [BlockDeleteArgs]>(),
      },
      $transaction: jest
        .fn<Promise<unknown[]>, [Promise<unknown>[]]>()
        .mockImplementation((ops) => Promise.all(ops)),
    };
    notifications = {
      notify: jest.fn(),
      clearFriendRequest: jest.fn(),
      clearFriendNotifications: jest.fn(),
    };
    service = new BlockService(
      prisma as unknown as PrismaService,
      new CaslAbilityFactory(),
      notifications as unknown as NotificationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBlockStatus', () => {
    it('reports blockedByMe when only the caller has blocked the target', async () => {
      prisma.block.findUnique
        .mockResolvedValueOnce(makeBlock({ blockerId: 1, blockedId: 2 }))
        .mockResolvedValueOnce(null);

      const result = await service.getBlockStatus(1, 2);

      expect(prisma.block.findUnique).toHaveBeenNthCalledWith(1, {
        where: { blockerId_blockedId: { blockerId: 1, blockedId: 2 } },
      });
      expect(prisma.block.findUnique).toHaveBeenNthCalledWith(2, {
        where: { blockerId_blockedId: { blockerId: 2, blockedId: 1 } },
      });
      expect(result).toEqual({ blockedByMe: true, blockedMe: false });
    });

    it('throws not found when the target has blocked the caller, instead of exposing blockedMe', async () => {
      prisma.block.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeBlock({ blockerId: 2, blockedId: 1 }));

      await expect(service.getBlockStatus(1, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws not found on a mutual block, instead of exposing blockedMe', async () => {
      prisma.block.findUnique
        .mockResolvedValueOnce(makeBlock({ blockerId: 1, blockedId: 2 }))
        .mockResolvedValueOnce(makeBlock({ blockerId: 2, blockedId: 1 }));

      await expect(service.getBlockStatus(1, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('reports both flags false when no block exists', async () => {
      prisma.block.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.getBlockStatus(1, 2);

      expect(result).toEqual({ blockedByMe: false, blockedMe: false });
    });
  });

  describe('getBlockedUsers', () => {
    it("rejects viewing another user's blocked users", async () => {
      await expect(
        service.getBlockedUsers(viewer(1), 2),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(prisma.block.findMany).not.toHaveBeenCalled();
    });

    it('returns users blocked by the caller, mapped to the blocked user', async () => {
      const blocked = {
        id: 2,
        username: 'blocked-2',
        avatarUrl: '/uploads/avatars/default.svg',
      };
      prisma.block.findMany.mockResolvedValue([
        makeBlock({ id: 20, blockerId: 1, blockedId: 2, blocked }),
      ]);

      const result = await service.getBlockedUsers(viewer(1), 1);

      expect(prisma.block.findMany).toHaveBeenCalledWith({
        where: { blockerId: 1 },
        include: {
          blocked: { select: { id: true, username: true, avatarUrl: true } },
        },
      });
      expect(result).toEqual([
        {
          blockId: 20,
          createdAt: new Date('2024-01-01'),
          user: blocked,
        },
      ]);
    });
  });

  describe('blockUser', () => {
    it('rejects blocking yourself', async () => {
      await expect(service.blockUser(1, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.block.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects when the caller already blocked the target', async () => {
      prisma.block.findUnique.mockResolvedValue(makeBlock());

      await expect(service.blockUser(1, 2)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates the block and soft-deletes any friendship between the two users', async () => {
      prisma.block.findUnique.mockResolvedValue(null);
      prisma.block.create.mockResolvedValue(makeBlock());
      prisma.friendship.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.blockUser(1, 2);

      expect(prisma.block.create).toHaveBeenCalledWith({
        data: { blockerId: 1, blockedId: 2 },
      });
      expect(notifications.clearFriendNotifications).toHaveBeenCalledWith(2, 1);
      expect(notifications.clearFriendNotifications).toHaveBeenCalledWith(1, 2);
      expect(prisma.friendship.updateMany).toHaveBeenCalledWith({
        where: { deletedAt: null, userAId: 1, userBId: 2 },
        data: { deletedAt: expect.any(Date) as Date },
      });
      expect(result.blockerId).toBe(1);
      expect(result.blockedId).toBe(2);
    });

    it('only checks its own direction, allowing a mutual block even if the target already blocked the caller', async () => {
      prisma.block.findUnique.mockResolvedValue(null);
      prisma.block.create.mockResolvedValue(
        makeBlock({ id: 21, blockerId: 1, blockedId: 2 }),
      );
      prisma.friendship.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.blockUser(1, 2);

      expect(prisma.block.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.block.findUnique).toHaveBeenCalledWith({
        where: { blockerId_blockedId: { blockerId: 1, blockedId: 2 } },
      });
      expect(result.blockerId).toBe(1);
      expect(result.blockedId).toBe(2);
    });
  });

  describe('unblockUser', () => {
    it('throws when the caller has not blocked the target', async () => {
      prisma.block.findUnique.mockResolvedValue(null);

      await expect(service.unblockUser(viewer(1), 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.block.delete).not.toHaveBeenCalled();
    });

    it('deletes the block when found', async () => {
      prisma.block.findUnique.mockResolvedValue(makeBlock({ id: 20 }));
      prisma.block.delete.mockResolvedValue(undefined);

      await service.unblockUser(viewer(1), 2);

      expect(prisma.block.delete).toHaveBeenCalledWith({ where: { id: 20 } });
    });
  });
});
