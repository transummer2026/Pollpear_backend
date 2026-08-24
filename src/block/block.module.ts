import { Module } from '@nestjs/common';
import { BlockService } from './block.service';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [BlockService],
  exports: [BlockService],
})
export class BlockModule {}
