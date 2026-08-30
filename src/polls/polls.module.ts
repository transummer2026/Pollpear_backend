import { Logger, Module } from '@nestjs/common';
import { PollsService } from './polls.service';
import { PollsExpiryService } from './polls-expiry.service';
import { PollsController } from './polls.controller';
import { UsersModule } from 'src/users/users.module';
import { OptionsModule } from 'src/options/options.module';
import { HashtagsModule } from 'src/hashtags/hashtags.module';
import { VotesModule } from 'src/votes/votes.module';

@Module({
  imports: [UsersModule, OptionsModule, HashtagsModule, VotesModule],
  controllers: [PollsController],
  providers: [PollsService, PollsExpiryService, Logger],
  exports: [PollsService],
})
export class PollsModule {}
