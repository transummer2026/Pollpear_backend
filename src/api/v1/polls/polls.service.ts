import { Injectable } from '@nestjs/common';

@Injectable()
export class PollsService {
  findAllPolls() {
    return 'Get all polls - not implemented';
  }

  findOnePoll(id: number) {
    return `Get poll ${id} - not implemented`;
  }

  findPollResults(id: number) {
    return `Get poll ${id} results - not implemented`;
  }
}
