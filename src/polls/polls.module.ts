import { Module } from '@nestjs/common';
import { PollsService } from './polls.service';
import { PollsController } from './polls.controller';
import { PollsWsController } from './polls.controller-ws';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [PollsController],
  providers: [PollsService, PollsWsController],
})
export class PollsModule {}
