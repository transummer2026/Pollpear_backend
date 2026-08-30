import { Injectable, NotFoundException } from '@nestjs/common';
import { ForbiddenError, subject } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import {
  MessageCreateDTO,
  MessageHistoryQueryDTO,
  MessageReadSchema,
} from 'Pollpear_shared/src/schemas/messages.schema';
import type { AppAbility } from 'src/casl/casl-prisma';
import type { Message, Prisma, User } from 'src/generated/prisma/client';

type RoomForAbility = Prisma.RoomGetPayload<{
  include: { roomMembers: true };
}>;

type MessageForAbility = Pick<Message, 'authorId' | 'roomId' | 'deletedAt'> & {
  room: RoomForAbility;
};

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
  ) {}

  async listForRoom(
    roomId: number,
    viewer: User,
    { before, after, limit }: MessageHistoryQueryDTO,
  ) {
    const ability = this.abilityFactory.createForUser(viewer);
    const readable = await this.prisma.room.count({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType('Room'),
          { id: roomId, deletedAt: null },
        ],
      },
    });
    if (!readable) throw new NotFoundException('Room not found');

    const messages = await this.prisma.message.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType('Message'),
          { roomId, deletedAt: null },
          ...(before ? [{ id: { lt: before } }] : []),
          ...(after ? [{ id: { gt: after } }] : []),
        ],
      },
      include: { author: true },
      orderBy: { id: after ? 'asc' : 'desc' },
      take: limit,
    });

    const ascending = after ? messages : messages.reverse();

    return ascending.map((message) => MessageReadSchema.parse(message));
  }

  async create(viewer: User, { roomId, content }: MessageCreateDTO) {
    const ability = this.abilityFactory.createForUser(viewer);
    const room = await this.roomForAbility(roomId);
    this.assertCan('create', ability, room, viewer.id);

    const message = await this.prisma.message.create({
      data: { roomId, authorId: viewer.id, content },
      include: { author: true },
    });

    return MessageReadSchema.parse(message);
  }

  async assertCanJoin(viewer: User, roomId: number): Promise<void> {
    const ability = this.abilityFactory.createForUser(viewer);
    const room = await this.roomForAbility(roomId);
    this.assertCan('read', ability, room, viewer.id);
  }

  private assertCan(
    action: 'read' | 'create',
    ability: AppAbility,
    room: RoomForAbility,
    authorId: number,
  ): void {
    const draft: MessageForAbility = {
      authorId,
      roomId: room.id,
      deletedAt: null,
      room,
    };

    ForbiddenError.from(ability).throwUnlessCan(
      action,
      subject('Message', draft as unknown as Message),
    );
  }

  private async roomForAbility(roomId: number): Promise<RoomForAbility> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, deletedAt: null },
      include: { roomMembers: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    return room;
  }
}
