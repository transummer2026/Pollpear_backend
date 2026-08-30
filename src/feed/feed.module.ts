import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { PollsModule } from 'src/polls/polls.module';
import { AiModule } from 'src/ai/ai.module';

@Module({
  imports: [PollsModule, AiModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
