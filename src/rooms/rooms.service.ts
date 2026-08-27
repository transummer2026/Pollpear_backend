import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma, User } from 'src/generated/prisma/client';
import {
  RoomCreateDTO,
  RoomReadSchema,
  RoomUpdateDTO,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { ForbiddenError, subject } from '@casl/ability';
import { PollsService, getPollIncludeArgs } from 'src/polls/polls.service';
import { accessibleBy } from 'src/casl/casl-prisma';
import {
  SEARCH_RESULTS_LIMIT,
  type SearchOptions,
} from 'src/search/search-options';

type RoomSearchRow = { id: number; name: string };

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
    private pollsService: PollsService,
  ) {}

  /**
   * Prefix matches on name rank first, then contains matches fill the
   * rest, mirroring UsersService#search. Pagination walks both phases with
   * `skip`/`take` so page N stays consistent with page N-1. The readable
   * scope is derived from the CASL room-read policy via `accessibleBy`
   * instead of re-encoding it, so search never surfaces a room the
   * requester couldn't otherwise read (and, unlike the old hand-rolled
   * `visibility: 'public'` filter, correctly includes the requester's
   * own non-public rooms).
   */
  async search(
    q: string,
    viewer: User,
    {
      page = 1,
      limit = SEARCH_RESULTS_LIMIT,
      sortBy = 'relevance',
    }: SearchOptions = {},
  ) {
    const ability = this.abilityFactory.createForUser(viewer);
    const baseWhere: Prisma.RoomWhereInput = {
      deletedAt: null,
      ...accessibleBy(ability, 'read').ofType('Room'),
    };
    const matchWhere: Prisma.RoomWhereInput = {
      ...baseWhere,
      name: { contains: q, mode: 'insensitive' },
    };

    const total = await this.prisma.room.count({ where: matchWhere });
    const skip = (page - 1) * limit;

    if (sortBy === 'alphabetical') {
      const items = await this.prisma.room.findMany({
        where: matchWhere,
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      });
      return { items, total };
    }

    const startsWithFilter: Prisma.RoomWhereInput = {
      name: { startsWith: q, mode: 'insensitive' },
    };
    const startsWithWhere: Prisma.RoomWhereInput = {
      ...baseWhere,
      ...startsWithFilter,
    };
    const startsWithTotal = await this.prisma.room.count({
      where: startsWithWhere,
    });

    let items: RoomSearchRow[] = [];
    if (skip < startsWithTotal) {
      items = await this.prisma.room.findMany({
        where: startsWithWhere,
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      });
    }

    const remaining = limit - items.length;
    if (remaining > 0) {
      const contains = await this.prisma.room.findMany({
        where: {
          ...matchWhere,
          NOT: startsWithFilter,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip: Math.max(0, skip - startsWithTotal),
        take: remaining,
      });
      items = [...items, ...contains];
    }

    return { items, total };
  }

  async create(userId: number, body: RoomCreateDTO) {
    return await this.createRoom(userId, body);
  }

  async update(id: number, userId: number, body: RoomUpdateDTO) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const room = await this.prisma.room.findUniqueOrThrow({
      where: { id, deletedAt: null },
    });

    const ability = this.abilityFactory.createForUser(user);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('Room', room),
    );

    return await this.updateRoom(id, body);
  }

  async remove(id: number, userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const room = await this.prisma.room.findUniqueOrThrow({
      where: { id, deletedAt: null },
    });

    const ability = this.abilityFactory.createForUser(user);
    ForbiddenError.from(ability).throwUnlessCan(
      'delete',
      subject('Room', room),
    );

    return await this.deleteRoom(id);
  }

  addParticipant(id: number, userId: number) {
    return `add user #${userId} for Room #${id} works`;
  }

  removeParticipant(id: number, userId: number) {
    return `remove user #${userId} from room #${id} works`;
  }

  getMessages(id: number) {
    return `get messages from room #${id} works`;
  }

  createMessage(id: number) {
    return `create message in room #${id} works`;
  }

  removeMessage(id: number, messageId: number) {
    return `remove message #${messageId} from room #${id} works`;
  }

  private async abilityFor(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true },
    });
    return this.abilityFactory.createForUser(user);
  }

  // Prisma helpers

  /**
   *
   * @param userId
   * @param body
   * @returns
   */
  async createRoom(userId: number, body: RoomCreateDTO) {
    return await this.prisma.room.create({
      data: {
        ...body,
        createdById: userId,
        status: 'active',
        roomMembers: {
          create: {
            userId: userId,
            joinedAt: new Date(),
          },
        },
      },
    });
  }

  async updateRoom(roomId: number, body: RoomUpdateDTO) {
    return await this.prisma.room.update({
      where: { id: roomId },
      data: body,
    });
  }

  async deleteRoom(roomId: number) {
    return await this.prisma.room.update({
      where: { id: roomId },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async findMeOneRoom(roomId: number, userId: number) {
    const [user, roomForAbilityCheck] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.room.findUniqueOrThrow({
        where: { id: roomId, deletedAt: null },
        include: { roomMembers: { where: { deletedAt: null } } },
      }),
    ]);

    const ability = this.abilityFactory.createForUser(user);
    ForbiddenError.from(ability).throwUnlessCan(
      'read',
      subject('Room', roomForAbilityCheck),
    );

    const [room, votesMadeByUser] = await Promise.all([
      this.prisma.room.findUniqueOrThrow({
        where: {
          id: roomId,
          deletedAt: null,
        },
        include: getRoomIncludeArgs(userId),
      }),
      this.prisma.vote.findMany({
        where: {
          createdById: userId,
          deletedAt: null,
        },
      }),
    ]);

    return RoomReadSchema.parse({
      ...room,
      polls: this.pollsService.shapeManyPollsForUser(
        room.polls,
        votesMadeByUser,
      ),
    });
  }

  async findMeManyRooms(userId: number) {
    const ability = await this.abilityFor(userId);
    const [rooms, votesMadeByUser] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Room'),
            {
              createdById: userId,
              deletedAt: null,
            },
          ],
        },
        include: getRoomIncludeArgs(userId),
      }),
      this.prisma.vote.findMany({
        where: {
          createdById: userId,
          deletedAt: null,
        },
      }),
    ]);

    return rooms.map((room) =>
      RoomReadSchema.parse({
        ...room,
        polls: this.pollsService.shapeManyPollsForUser(
          room.polls,
          votesMadeByUser,
        ),
      }),
    );
  }

  async findUsersManyRooms(userId: number, targetId: number) {
    const ability = await this.abilityFor(userId);
    const [rooms, votesMadeByUser] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Room'),
            {
              OR: [
                {
                  createdById: targetId,
                  deletedAt: null,
                },
                {
                  visibility: 'public',
                  deletedAt: null,
                },
                {
                  roomMembers: {
                    some: {
                      userId: userId,
                    },
                  },
                  deletedAt: null,
                },
              ],
            },
          ],
        },
        include: getRoomIncludeArgs(userId),
      }),
      this.prisma.vote.findMany({
        where: {
          createdById: userId,
          deletedAt: null,
        },
      }),
    ]);

    return rooms.map((room) =>
      RoomReadSchema.parse({
        ...room,
        polls: this.pollsService.shapeManyPollsForUser(
          room.polls,
          votesMadeByUser,
        ),
      }),
    );
  }

  async findManyRooms(userId: number) {
    const ability = await this.abilityFor(userId);
    const [rooms, votesMadeByUser] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Room'),
            {
              OR: [
                {
                  createdById: userId,
                  deletedAt: null,
                },
                {
                  visibility: 'public',
                  deletedAt: null,
                },
                {
                  roomMembers: {
                    some: {
                      userId: userId,
                    },
                  },
                  deletedAt: null,
                },
              ],
            },
          ],
        },
        include: getRoomIncludeArgs(userId),
      }),
      this.prisma.vote.findMany({
        where: {
          createdById: userId,
          deletedAt: null,
        },
      }),
    ]);

    return rooms.map((room) =>
      RoomReadSchema.parse({
        ...room,
        polls: this.pollsService.shapeManyPollsForUser(
          room.polls,
          votesMadeByUser,
        ),
      }),
    );
  }
}

/**
 * The relations a room needs loaded to satisfy `RoomReadSchema`: other
 * active members, undeleted messages, undeleted polls (with their own
 * `getPollIncludeArgs`), the creator, and pending invitations. Shared so
 * `findMeOneRoom` and `findMeManyRooms` fetch this identically instead of
 * each hand-rolling their own `include`.
 */
export function getRoomIncludeArgs(userId: number) {
  return {
    roomMembers: {
      where: {
        deletedAt: null,
        userId: { not: userId },
      },
    },
    messages: {
      where: {
        deletedAt: null,
      },
    },
    polls: {
      where: {
        deletedAt: null,
      },
      include: getPollIncludeArgs(),
    },
    createdBy: true,
    invitations: {
      where: {
        deletedAt: null,
        status: 'pending',
      },
    },
  } satisfies Prisma.RoomInclude;
}
