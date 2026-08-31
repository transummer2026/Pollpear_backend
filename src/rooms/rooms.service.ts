import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma, User } from 'src/generated/prisma/client';
import {
  RoomCreateDTO,
  RoomReadSchema,
  RoomUpdateDTO,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import { MESSAGE_PAGE_SIZE } from 'Pollpear_shared/src/schemas/messages.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { ForbiddenError, subject } from '@casl/ability';
import { PollsService, getPollIncludeArgs } from 'src/polls/polls.service';
import { accessibleBy, type AppAbility } from 'src/casl/casl-prisma';
import {
  SEARCH_RESULTS_LIMIT,
  type SearchOptions,
} from 'src/search/search-options';
import { nextRoomStatus, syncRoomStatuses } from './room-status';
import { syncPollStatuses } from 'src/polls/poll-status';

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

  async create(viewer: User, body: RoomCreateDTO) {
    return await this.createRoom(viewer.id, body);
  }

  async update(id: number, viewer: User, body: RoomUpdateDTO) {
    const found = await this.prisma.room.findFirst({
      where: { id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('Room not found');

    // Fold a lapsed `endsAt` into `status` before the check, so an ended
    // room can no longer be edited (the `update` rule needs `status: 'active'`).
    const [room] = await syncRoomStatuses(this.prisma, [found]);

    const ability = this.abilityFactory.createForUser(viewer);
    const guard = ForbiddenError.from(ability);
    const target = subject('Room', room);

    // `can('update', room)` only asks whether *some* update rule matches the
    // subject. On a closed room the `['status']`-scoped rule matches, so the
    // bare check passes and the whole body would be written. Re-check every
    // field the body actually touches against the field-scoped rules.
    guard.throwUnlessCan('update', target);
    for (const field of Object.keys(body)) {
      guard.throwUnlessCan('update', target, field);
    }

    return await this.updateRoom(id, body);
  }

  async remove(id: number, viewer: User) {
    const room = await this.prisma.room.findFirst({
      where: { id, deletedAt: null },
    });
    if (!room) throw new NotFoundException('Room not found');

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'delete',
      subject('Room', room),
    );

    return await this.deleteRoom(id);
  }

  removeMessage(id: number, messageId: number) {
    return `remove message #${messageId} from room #${id} works`;
  }

  /**
   * Self-join only: the caller always joins as themselves. Room-level
   * eligibility (public room, or an accepted invitation) is entirely
   * expressed by the CASL `join` rule, so `accessibleBy` is the check —
   * no extra instance-level guard needed once the row comes back.
   *
   * `ability` and `client` are injectable so the invitation-accept flow
   * can run this inside its own `$transaction` (re-checking `join` against
   * the just-written "accepted" row) with the ability it already built.
   */
  async addParticipant(
    viewer: User,
    roomId: number,
    ability: AppAbility = this.abilityFactory.createForUser(viewer),
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const room = await client.room.findFirst({
      where: {
        AND: [
          accessibleBy(ability, 'join').ofType('Room'),
          { id: roomId, deletedAt: null },
        ],
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    const existing = await client.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: viewer.id } },
    });
    // Already an active member → idempotent no-op. Do NOT rewrite
    // `joinedAt`: a redundant POST /participants must not reset it.
    if (existing && existing.deletedAt === null) return existing;
    if (existing) {
      return await client.roomMember.update({
        where: { id: existing.id },
        data: { deletedAt: null, joinedAt: new Date() },
      });
    }
    return await client.roomMember.create({
      data: { roomId, userId: viewer.id, joinedAt: new Date() },
    });
  }

  /**
   * Removing yourself is `leave`; removing someone else is `kick`
   * (creator, or a moderator's blanket rule). `RoomMember` isn't a CASL
   * subject, so the permission check runs against the Room via
   * `accessibleBy`, then the target's membership row is looked up in
   * plain Prisma.
   */
  async removeParticipant(viewer: User, roomId: number, targetUserId: number) {
    const ability = this.abilityFactory.createForUser(viewer);
    const action = targetUserId === viewer.id ? 'leave' : 'kick';

    const room = await this.prisma.room.findFirst({
      where: {
        AND: [
          accessibleBy(ability, action).ofType('Room'),
          { id: roomId, deletedAt: null },
        ],
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    const member = await this.prisma.roomMember.findFirst({
      where: { roomId, userId: targetUserId, deletedAt: null },
    });
    if (!member) throw new NotFoundException('Participant not found');

    // A moderator's blanket `kick` would otherwise let them remove the
    // room owner, leaving the room with no active owner-member.
    if (action === 'kick' && targetUserId === room.createdById) {
      throw new ForbiddenException('The room owner cannot be removed.');
    }

    const now = new Date();

    if (action === 'leave') {
      return await this.prisma.roomMember.update({
        where: { id: member.id },
        data: { deletedAt: now },
      });
    }

    // Kick: also revoke the target's accepted invitation so the removal
    // sticks. Otherwise `roomJoinConditions` still matches on the leftover
    // "accepted" row and the kicked user could re-POST /participants
    // straight back into a private room. Scoped by the CASL `delete`
    // rule on `Invitation` (room owner as inviter, or a moderator's
    // blanket rule), same as `InvitationService#removeInvitation`.
    // Re-admission goes through a fresh `createRoomInvitation()`.
    const [updatedMember] = await this.prisma.$transaction([
      this.prisma.roomMember.update({
        where: { id: member.id },
        data: { deletedAt: now },
      }),
      this.prisma.invitation.updateMany({
        where: {
          AND: [
            accessibleBy(ability, 'delete').ofType('Invitation'),
            { roomId, inviteeId: targetUserId, status: 'accepted' },
          ],
        },
        data: { deletedAt: now },
      }),
    ]);
    return updatedMember;
  }

  // Prisma helpers

  async createRoom(userId: number, body: RoomCreateDTO) {
    return await this.prisma.room.create({
      data: {
        ...body,
        createdById: userId,
        status: nextRoomStatus({ endsAt: body.endsAt }),
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

  async findOneRoom(roomId: number, viewer: User) {
    const ability = this.abilityFactory.createForUser(viewer);
    const [room, votesMadeByUser] = await Promise.all([
      this.prisma.room.findFirst({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Room'),
            { id: roomId, deletedAt: null },
          ],
        },
        include: getRoomIncludeArgs(viewer.id, ability),
      }),
      this.prisma.vote.findMany({
        where: {
          createdById: viewer.id,
          deletedAt: null,
        },
      }),
    ]);
    if (!room) throw new NotFoundException('Room not found');

    const [synced] = await syncRoomStatuses(this.prisma, [room]);

    return RoomReadSchema.parse({
      ...synced,
      polls: this.pollsService.shapeManyPollsForUser(
        await syncPollStatuses(this.prisma, synced.polls),
        votesMadeByUser,
      ),
    });
  }

  async findMeManyRooms(viewer: User) {
    const ability = this.abilityFactory.createForUser(viewer);
    const [rooms, votesMadeByUser] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Room'),
            {
              createdById: viewer.id,
              deletedAt: null,
            },
          ],
        },
        include: getRoomIncludeArgs(viewer.id, ability),
      }),
      this.prisma.vote.findMany({
        where: {
          createdById: viewer.id,
          deletedAt: null,
        },
      }),
    ]);

    const syncedRooms = await syncRoomStatuses(this.prisma, rooms);
    return Promise.all(
      syncedRooms.map(async (room) =>
        RoomReadSchema.parse({
          ...room,
          polls: this.pollsService.shapeManyPollsForUser(
            await syncPollStatuses(this.prisma, room.polls),
            votesMadeByUser,
          ),
        }),
      ),
    );
  }

  async findUsersManyRooms(viewer: User, targetId: number) {
    const ability = this.abilityFactory.createForUser(viewer);
    const [rooms, votesMadeByUser] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Room'),
            { createdById: targetId, deletedAt: null },
          ],
        },
        include: getRoomIncludeArgs(viewer.id, ability),
      }),
      this.prisma.vote.findMany({
        where: {
          createdById: viewer.id,
          deletedAt: null,
        },
      }),
    ]);

    const syncedRooms = await syncRoomStatuses(this.prisma, rooms);
    return Promise.all(
      syncedRooms.map(async (room) =>
        RoomReadSchema.parse({
          ...room,
          polls: this.pollsService.shapeManyPollsForUser(
            await syncPollStatuses(this.prisma, room.polls),
            votesMadeByUser,
          ),
        }),
      ),
    );
  }

  async findManyRooms(viewer: User) {
    const ability = this.abilityFactory.createForUser(viewer);
    const [rooms, votesMadeByUser] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Room'),
            {
              OR: [
                {
                  createdById: viewer.id,
                  deletedAt: null,
                },
                {
                  visibility: 'public',
                  deletedAt: null,
                },
                {
                  roomMembers: {
                    some: {
                      userId: viewer.id,
                    },
                  },
                  deletedAt: null,
                },
              ],
            },
          ],
        },
        include: getRoomIncludeArgs(viewer.id, ability),
      }),
      this.prisma.vote.findMany({
        where: {
          createdById: viewer.id,
          deletedAt: null,
        },
      }),
    ]);

    const syncedRooms = await syncRoomStatuses(this.prisma, rooms);
    return Promise.all(
      syncedRooms.map(async (room) =>
        RoomReadSchema.parse({
          ...room,
          polls: this.pollsService.shapeManyPollsForUser(
            await syncPollStatuses(this.prisma, room.polls),
            votesMadeByUser,
          ),
        }),
      ),
    );
  }
}

/**
 * The relations a room needs loaded to satisfy `RoomReadSchema`: other
 * active members, undeleted polls (with their own
 * `getPollIncludeArgs`), the creator, and pending invitations. Shared so
 * `findOneRoom` and `findMeManyRooms` fetch this identically instead of
 * each hand-rolling their own `include`.
 */
export function getRoomIncludeArgs(userId: number, ability: AppAbility) {
  return {
    roomMembers: {
      where: {
        deletedAt: null,
        userId: { not: userId },
      },
    },
    polls: {
      where: {
        deletedAt: null,
      },
      include: getPollIncludeArgs(),
    },
    messages: {
      where: accessibleBy(ability, 'read').ofType('Message'),
      include: { author: true },
      orderBy: { id: 'asc' },
      take: -MESSAGE_PAGE_SIZE,
    },
    createdBy: true,
    invitations: {
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType('Invitation'),
          { status: 'pending' },
        ],
      },
      include: {
        invitee: true,
        inviter: true,
        room: true,
      },
    },
  } satisfies Prisma.RoomInclude;
}
