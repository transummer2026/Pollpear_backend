import { Logger, NotFoundException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
} from '@nestjs/websockets';
import { ForbiddenError } from '@casl/ability';
import { Socket } from 'socket.io';
import {
  MessageCreateSchema,
  type MessageCreateDTO,
} from 'Pollpear_shared/src/schemas/messages.schema';
import {
  RoomChannelSchema,
  type RoomChannelDTO,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import type { User } from 'src/generated/prisma/client';
import { WsZodValidationPipe } from 'src/common/pipes/ws-zod-validation.pipe';
import { AuthenticatedGateway } from 'src/websocket/authenticated-gateway.decorator';
import { roomChannel } from 'src/websocket/socket-user';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
import { refuseWs } from 'src/websocket/ws-refuse';
import { WsUser } from 'src/websocket/ws-user.decorator';
import { MessagesService } from './messages.service';

@AuthenticatedGateway()
export class MessagesGateway {
  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private messages: MessagesService,
    private emitter: WebsocketEmitter,
  ) {}

  @SubscribeMessage('room:join')
  async join(
    @ConnectedSocket() client: Socket,
    @WsUser() viewer: User,
    @MessageBody(new WsZodValidationPipe(RoomChannelSchema))
    payload: RoomChannelDTO,
  ) {
    return this.guarded(client, payload, async () => {
      await this.messages.assertCanJoin(viewer, payload.roomId);
      await client.join(roomChannel(payload.roomId));
      this.logger.debug(
        `user ${viewer.id} joined room channel ${payload.roomId}`,
      );

      return { roomId: payload.roomId };
    });
  }

  @SubscribeMessage('room:leave')
  async leave(
    @ConnectedSocket() client: Socket,
    @MessageBody(new WsZodValidationPipe(RoomChannelSchema))
    payload: RoomChannelDTO,
  ) {
    await client.leave(roomChannel(payload.roomId));

    return { roomId: payload.roomId };
  }

  @SubscribeMessage('message:send')
  async send(
    @ConnectedSocket() client: Socket,
    @WsUser() viewer: User,
    @MessageBody(new WsZodValidationPipe(MessageCreateSchema))
    payload: MessageCreateDTO,
  ) {
    return this.guarded(client, { roomId: payload.roomId }, async () => {
      const message = await this.messages.create(viewer, payload);
      this.emitter.toRoom(payload.roomId, 'message:new', message, client.id);
      this.logger.debug(
        `message ${message.id} in room ${payload.roomId} by user ${viewer.id}`,
      );

      return message;
    });
  }

  private async guarded<T>(
    client: Socket,
    payload: unknown,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        refuseWs(this.logger, client, 'Access denied', payload);
      }
      if (error instanceof NotFoundException) {
        refuseWs(this.logger, client, error.message, payload);
      }
      throw error;
    }
  }
}
