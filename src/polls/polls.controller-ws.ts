/**
 * Vote events, websocket phase 2 of the sequence diagram (poll:vote in,
 * poll:update out). poll:update is broadcast to every connected client
 * as drawn in the diagram: results are public, and per-poll targeting
 * would need subscription bookkeeping that does not exist yet.
 */
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

  constructor(private readonly pollsService: PollsService) {}

  @SubscribeMessage('poll:vote')
  async castVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    const userId = socketUserId(client);
    if (userId === null) throw new WsException('Unauthorized');

    const { optionId } = (payload ?? {}) as { optionId?: unknown };
    const optionIdNum = Number(optionId);
    if (!Number.isInteger(optionIdNum))
      throw new WsException('Invalid payload');

    const result = await this.pollsService.castVote(userId, optionIdNum);
    if (result.outcome !== 'ok') {
      throw new WsException(VOTE_ERRORS[result.outcome]);
    }

    this.server.emit('poll:update', {
      pollId: result.pollId,
      optionId: optionIdNum,
    });
    return { pollId: result.pollId, optionId: optionIdNum };
  }
}
