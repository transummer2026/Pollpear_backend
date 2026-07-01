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

  report(id: number) {
    return `report Poll #${id} works`;
  }

  reportOption(id: number, optionId: number) {
    return `report option #${optionId} for Poll #${id} works`;
  }

  removeOption(id: number, optionId: number) {
    return `remove option #${optionId} for Poll #${id} works`;
  }

  createVote(id: number) {
    return `create vote in Poll #${id} works`;
  }

  removeVote(id: number) {
    return `remove vote in Poll #${id} works`;
  }

  reportVote(id: number) {
    return `report vote in Poll #${id} works`;
  }
}
