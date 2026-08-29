import { Module } from '@nestjs/common';
import { ApiPollsService } from './polls.service';
import { ApiPollsController } from './polls.controller';
import { ApiPollVoteService } from './vote/vote.service';
import { ApiPollVoteController } from './vote/vote.controller';

@Module({
  controllers: [ApiPollsController, ApiPollVoteController],
  providers: [ApiPollsService, ApiPollVoteService],
})
export class ApiPollsModule {}
