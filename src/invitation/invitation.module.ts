import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
