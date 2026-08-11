import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const SEARCH_RESULTS_LIMIT = 5;

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  create() {
    return 'add a new room works';
  }

  search(q: string) {
    return this.prisma.room.findMany({
      where: {
        visibility: 'public',
        name: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, name: true },
      take: SEARCH_RESULTS_LIMIT,
    });
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
}
