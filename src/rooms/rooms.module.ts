import { Logger, Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomsExpiryService } from './rooms-expiry.service';
import { PollsModule } from 'src/polls/polls.module';
import { MessagesModule } from 'src/messages/messages.module';
import { InvitationModule } from 'src/invitation/invitation.module';

@Module({
  imports: [PollsModule, MessagesModule, InvitationModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsExpiryService, Logger],
  exports: [RoomsService],
})
export class RoomsModule {}
