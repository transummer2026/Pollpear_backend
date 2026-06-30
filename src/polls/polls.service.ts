import { HttpCode, Injectable, Post } from '@nestjs/common';

@Injectable()
export class PollsService {
  @Post()
  @HttpCode(503)
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
    return `Report Poll #${id} works`;
  }

  reportPollOption(id: number, optionId: number) {
    return `Report option #${optionId} for Poll #${id} works`;
  }

  removePollOption(id: number, optionId: number) {
    return `Remove option #${optionId} for Poll #${id} works`;
  }

  findAll() {
    return `This action returns all polls`;
  }

  findOne(id: number) {
    return `remove poll #${id} works`;
  }


}
