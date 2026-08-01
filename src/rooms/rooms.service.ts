import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  create() {
    return 'add a new room works';
  }

  update(id: number) {
    return `update room #${id} works`;
  }

  remove(id: number) {
    return `remove room #${id} works`;
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

  // WebSocket-related methods

  /**
   * Returns the IDs of all members in a room.
   * @param roomId id of the room to get members
   * @returns {Promise<number[]>} array of user IDs
   */
  async memberIds(roomId: number): Promise<number[]> {
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  /**
   * Saves a message in the database.
   * @param roomId id of the room to get members
   * @param authorId message author id
   * @param content message content
   * @returns {Promise<Message>} the created message
   */
  saveMessage(roomId: number, authorId: number, content: string) {
    return this.prisma.message.create({
      data: { roomId, authorId, content },
    });
  }

  /**
   * marks a message as deleted by setting its deletedAt field to the current date.
   * @param messageId id of the message to delete
   * @param authorId id of the author of the message
   * @returns {Promise<Message | null>} the soft-deleted message or null if not found
   */
  async softDeleteMessage(messageId: number, authorId: number) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, authorId, deletedAt: null },
    });
    if (!message) return null;

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
    return message;
  }
}
