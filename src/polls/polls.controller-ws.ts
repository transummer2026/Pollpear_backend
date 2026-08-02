/**
 * Vote events, websocket phase 2 of the sequence diagram (poll:vote in,
 * poll:update out). poll:update is broadcast to every connected client
 * as drawn in the diagram: results are public, and per-poll targeting
 * would need subscription bookkeeping that does not exist yet.
 */
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { socketUserId } from 'src/websocket/socket-user';
import { PollsService } from './polls.service';

const VOTE_ERRORS = {
  not_found: 'Option not found',
  closed: 'Poll is closed',
  locked: 'Vote can not be changed on this poll',
} as const;

@WebSocketGateway()
export class PollsWsController {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PollsWsController.name);

  constructor(private readonly pollsService: PollsService) {}

  private refuse(client: Socket, reason: string, payload: unknown): never {
    this.logger.warn(
      `${reason} (socket ${client.id}, payload ${JSON.stringify(payload)})`,
    );
    throw new WsException(reason);
  }

  @SubscribeMessage('poll:vote')
  async castVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    const userId = socketUserId(client);
    if (userId === null) this.refuse(client, 'Unauthorized', payload);

    const { optionId } = (payload ?? {}) as { optionId?: unknown };
    const optionIdNum = Number(optionId);
    if (!Number.isInteger(optionIdNum)) {
      this.refuse(client, 'Invalid payload', payload);
    }

    const result = await this.pollsService.castVote(userId, optionIdNum);
    if (result.outcome !== 'ok') {
      this.refuse(client, VOTE_ERRORS[result.outcome], payload);
    }

    this.server.emit('poll:update', {
      pollId: result.pollId,
      optionId: optionIdNum,
    });
    this.logger.debug(
      `user ${userId} voted option ${optionIdNum} on poll ${result.pollId}, poll:update broadcast`,
    );
    return { pollId: result.pollId, optionId: optionIdNum };
  }
}
