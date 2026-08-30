import { forwardRef, Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { NotificationModule } from 'src/notification/notification.module';
import { RoomsModule } from 'src/rooms/rooms.module';

@Module({
  imports: [NotificationModule, forwardRef(() => RoomsModule)],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
