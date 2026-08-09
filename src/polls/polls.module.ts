import { Module } from '@nestjs/common';
import { PollsService } from './polls.service';
import { PollsController } from './polls.controller';
import { UsersModule } from 'src/users/users.module';
import { OptionsModule } from 'src/options/options.module';
import { HashtagsModule } from 'src/hashtags/hashtags.module';

@Module({
  imports: [UsersModule, OptionsModule, HashtagsModule],
  controllers: [PollsController],
  providers: [PollsService],
})
export class PollsModule {}
