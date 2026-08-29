import { Logger, Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { PollsModule } from 'src/polls/polls.module';
import { MessagesModule } from 'src/messages/messages.module';

@Module({
  imports: [PollsModule, MessagesModule],
  controllers: [RoomsController],
  providers: [RoomsService, Logger],
  exports: [RoomsService],
})
export class RoomsModule {}
