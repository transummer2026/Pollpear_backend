import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { socketUserId } from 'src/websocket/socket-user';
import { RoomsService } from './rooms.service';

const MAX_MESSAGE_LENGTH = 4000;

@WebSocketGateway()
export class RoomsWsController {
  private readonly logger = new Logger(RoomsWsController.name);

  constructor(private readonly roomsService: RoomsService) {}

  /**
   * Refusals are logged before being thrown: the client only receives a
   * short reason on its exception event, the server keeps who asked what.
   */
  private refuse(client: Socket, reason: string, payload: unknown): never {
    this.logger.warn(
      `${reason} (socket ${client.id}, payload ${JSON.stringify(payload)})`,
    );
    throw new WsException(reason);
  }

  @SubscribeMessage('room:message')
  async createMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    const userId = socketUserId(client);
    if (userId === null) this.refuse(client, 'Unauthorized', payload);

    const { roomId, content } = (payload ?? {}) as {
      roomId?: unknown;
      content?: unknown;
    };
    const roomIdNum = Number(roomId);
    const text = typeof content === 'string' ? content.trim() : '';
    if (
      !Number.isInteger(roomIdNum) ||
      text.length === 0 ||
      text.length > MAX_MESSAGE_LENGTH
    ) {
      this.refuse(client, 'Invalid payload', payload);
    }

    const members = await this.roomsService.memberIds(roomIdNum);
    if (!members.includes(userId)) {
      this.refuse(client, 'Not a room member', payload);
    }

    const message = await this.roomsService.saveMessage(
      roomIdNum,
      userId,
      text,
    );
    client
      .to(members.map((id) => `user:${id}`))
      .emit('room:new:message', { message });
    this.logger.debug(
      `message ${message.id} in room ${roomIdNum} by user ${userId}, broadcast to ${members.length - 1} member(s)`,
    );
    return { message };
  }

  @SubscribeMessage('room:message:delete')
  async deleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    const userId = socketUserId(client);
    if (userId === null) this.refuse(client, 'Unauthorized', payload);

    const { messageId } = (payload ?? {}) as { messageId?: unknown };
    const messageIdNum = Number(messageId);
    if (!Number.isInteger(messageIdNum)) {
      this.refuse(client, 'Invalid payload', payload);
    }

    const message = await this.roomsService.softDeleteMessage(
      messageIdNum,
      userId,
    );
    if (!message) this.refuse(client, 'Message not found', payload);

    const members = await this.roomsService.memberIds(message.roomId);
    client
      .to(members.map((id) => `user:${id}`))
      .emit('room:message:deleted', { messageId: messageIdNum });
    this.logger.debug(
      `message ${messageIdNum} deleted by user ${userId} in room ${message.roomId}`,
    );
    return { messageId: messageIdNum };
  }
}
