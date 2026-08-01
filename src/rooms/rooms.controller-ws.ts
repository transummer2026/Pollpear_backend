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
  constructor(private readonly roomsService: RoomsService) {}

  @SubscribeMessage('room:message')
  async createMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    const userId = socketUserId(client);
    if (userId === null) throw new WsException('Unauthorized');

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
      throw new WsException('Invalid payload');
    }

    const members = await this.roomsService.memberIds(roomIdNum);
    if (!members.includes(userId)) throw new WsException('Not a room member');

    const message = await this.roomsService.saveMessage(
      roomIdNum,
      userId,
      text,
    );
    client
      .to(members.map((id) => `user:${id}`))
      .emit('room:new:message', { message });
    return { message };
  }

  @SubscribeMessage('room:message:delete')
  async deleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    const userId = socketUserId(client);
    if (userId === null) throw new WsException('Unauthorized');

    const { messageId } = (payload ?? {}) as { messageId?: unknown };
    const messageIdNum = Number(messageId);
    if (!Number.isInteger(messageIdNum))
      throw new WsException('Invalid payload');

    const message = await this.roomsService.softDeleteMessage(
      messageIdNum,
      userId,
    );
    if (!message) throw new WsException('Message not found');

    const members = await this.roomsService.memberIds(message.roomId);
    client
      .to(members.map((id) => `user:${id}`))
      .emit('room:message:deleted', { messageId: messageIdNum });
    return { messageId: messageIdNum };
  }
}
