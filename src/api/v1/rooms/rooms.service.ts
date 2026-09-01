import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { subject } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy, type AppAbility } from 'src/casl/casl-prisma';
import type { Prisma, Room, User } from 'src/generated/prisma/client';
import { RoomStatus } from 'src/generated/prisma/enums';
import {
  closeExpiredRooms,
  nextRoomStatus,
  syncRoomStatuses,
} from 'src/rooms/room-status';
import { selectOf, type AssertColumns } from '../common/select';
import {
  assertLimitAllowed,
  assertPageWithin,
  pageMeta,
} from '../common/pagination';
import { skipFor } from '../common/schemas/api-pagination.schema';
import { matching } from './rooms.presentation';
import {
  ApiRoomOwnerSchema,
  ApiRoomColumnsSchema,
  ApiRoomListColumnsSchema,
  ApiRoomPageSchema,
  ApiRoomSchema,
  type ApiRoomColumnsDTO,
  type ApiRoomCreateDTO,
  type ApiRoomDTO,
  type ApiRoomListColumnsDTO,
  type ApiRoomOwnerDTO,
  type ApiRoomPageDTO,
  type ApiRoomQueryDTO,
  type ApiRoomUpdateDTO,
} from '../common/schemas/api-rooms.schema';

const OWNER_SELECT = { select: selectOf(ApiRoomOwnerSchema) };

const LIVE_MEMBERS = { where: { deletedAt: null } };

export const LIST_SELECT = {
  ...selectOf(ApiRoomListColumnsSchema),
  _count: { select: { roomMembers: LIVE_MEMBERS } },
} satisfies Prisma.RoomSelect;

/**
 * The poll count goes through the policy rather than a plain `deletedAt:
 * null`: a public room hosts private polls only its members may read, and a
 * raw count would give them away by their number.
 */
export const roomWithCounts = (ability: AppAbility) =>
  ({
    ...selectOf(ApiRoomColumnsSchema),
    createdById: true,
    deletedAt: true,
    createdBy: OWNER_SELECT,
    _count: {
      select: {
        roomMembers: LIVE_MEMBERS,
        polls: { where: accessibleBy(ability, 'read').ofType('Poll') },
      },
    },
  }) satisfies Prisma.RoomSelect;

export const LIST_MATCHES_MODEL: AssertColumns<ApiRoomListColumnsDTO, Room> =
  true;
export const DETAIL_MATCHES_MODEL: AssertColumns<ApiRoomColumnsDTO, Room> =
  true;
export const OWNER_MATCHES_MODEL: AssertColumns<ApiRoomOwnerDTO, User> = true;

type ListedRoom = Prisma.RoomGetPayload<{ select: typeof LIST_SELECT }>;
type DetailedRoom = Prisma.RoomGetPayload<{
  select: ReturnType<typeof roomWithCounts>;
}>;

@Injectable()
export class ApiRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async findAllRooms(
    query: ApiRoomQueryDTO,
    caller: User,
  ): Promise<ApiRoomPageDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    assertLimitAllowed(query, caller);

    const where: Prisma.RoomWhereInput = {
      AND: [accessibleBy(ability, 'read').ofType('Room'), matching(query)],
    };

    await closeExpiredRooms(this.prisma);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { id: 'desc' },
        skip: skipFor(query),
        take: query.limit,
      }),
      this.prisma.room.count({ where }),
    ]);
    assertPageWithin(query, total);

    const synced = await syncRoomStatuses(this.prisma, rows);

    return ApiRoomPageSchema.parse({
      data: synced.map((row) => this.listed(row)),
      ...pageMeta(query, total),
    });
  }

  async findOneRoom(id: number, caller: User): Promise<ApiRoomDTO> {
    const ability = this.abilityFactory.createForUser(caller);

    return this.detailed(await this.findReadableRoom(id, ability));
  }

  async createRoom(body: ApiRoomCreateDTO, caller: User): Promise<ApiRoomDTO> {
    const ability = this.abilityFactory.createForUser(caller);

    const created = await this.prisma.room.create({
      data: {
        ...body,
        status: nextRoomStatus({ endsAt: body.endsAt }),
        createdById: caller.id,
        roomMembers: { create: { userId: caller.id, joinedAt: new Date() } },
      },
      select: roomWithCounts(ability),
    });

    return this.detailed(created);
  }

  async updateRoom(
    id: number,
    body: ApiRoomUpdateDTO,
    caller: User,
  ): Promise<ApiRoomDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    const room = await this.findReadableRoom(id, ability);

    this.assertMayEdit(room, Object.keys(body), ability);

    const updated = await this.prisma.room.update({
      where: { id },
      data: body,
      select: roomWithCounts(ability),
    });

    return this.detailed(updated);
  }

  async removeRoom(id: number, caller: User): Promise<void> {
    const ability = this.abilityFactory.createForUser(caller);
    const room = await this.findReadableRoom(id, ability);

    this.assertMayDelete(room, ability);

    if (room.deletedAt !== null) {
      return;
    }

    await this.prisma.room.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'closed' },
    });
  }

  private async findReadableRoom(
    id: number,
    ability: AppAbility,
  ): Promise<DetailedRoom> {
    const room = await this.prisma.room.findFirst({
      where: {
        AND: [accessibleBy(ability, 'read').ofType('Room'), { id }],
      },
      select: roomWithCounts(ability),
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const [synced] = await syncRoomStatuses(this.prisma, [room]);

    return synced;
  }

  /**
   * The policy narrows some rules down to specific fields, so a question asked
   * without naming a field would answer yes to a caller who may only write
   * `status`. Every field of the body is therefore submitted on its own.
   */
  private assertMayEdit(
    room: DetailedRoom,
    fields: string[],
    ability: AppAbility,
  ): void {
    const target = subject('Room', room);
    const refused = fields.filter((field) =>
      ability.cannot('update', target, field),
    );

    if (refused.length === 0) {
      return;
    }

    const whileActive = subject('Room', {
      ...room,
      status: RoomStatus.active,
    });
    const blockedByStatusOnly = refused.every((field) =>
      ability.can('update', whileActive, field),
    );

    throw blockedByStatusOnly
      ? new ConflictException('A room can only be edited while it is active')
      : new ForbiddenException('Not allowed to edit this room');
  }

  private assertMayDelete(room: DetailedRoom, ability: AppAbility): void {
    if (ability.cannot('delete', subject('Room', room))) {
      throw new ForbiddenException('Not allowed to delete this room');
    }
  }

  private listed(row: ListedRoom) {
    const { _count, ...columns } = row;
    return { ...columns, memberCount: _count.roomMembers };
  }

  private detailed(row: DetailedRoom): ApiRoomDTO {
    const { _count, ...columns } = row;
    return ApiRoomSchema.parse({
      ...columns,
      memberCount: _count.roomMembers,
      pollCount: _count.polls,
    });
  }
}
