import { Module } from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';

@Module({
  imports: [UsersModule],
  providers: [MessagesGateway, MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
