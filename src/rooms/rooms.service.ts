
export class RoomsService {
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
}
