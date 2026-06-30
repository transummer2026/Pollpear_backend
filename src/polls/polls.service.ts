import { Injectable } from '@nestjs/common';

@Injectable()
export class PollsService {
  create() {
    return 'add new poll route works';
  }

  update(id: number) {
    return `update poll #${id} works`;
  }

  remove(id: number) {
    return `remove poll #${id} works`;
  }

  reportPoll(id: number) {
    return `report Poll #${id} works`;
  }

  reportPollOption(id: number, optionId: number) {
    return `report option #${optionId} for Poll #${id} works`;
  }

  removePollOption(id: number, optionId: number) {
    return `remove option #${optionId} for Poll #${id} works`;
  }

  createVote(id: number) {
    return `create vote in Poll #${id} works`;
  }

  deletePollVote(id: number) {
    return `remove vote in Poll #${id} works`;
  }

  reportPollVote(id: number) {
    return `report vote in Poll #${id} works`;
  }
}
