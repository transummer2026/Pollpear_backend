import { Logger, Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { PollsModule } from 'src/polls/polls.module';

@Module({
  imports: [PollsModule],
  controllers: [RoomsController],
  providers: [RoomsService, Logger],
  exports: [RoomsService],
})
export class RoomsModule {}
