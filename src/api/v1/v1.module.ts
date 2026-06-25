import { Module } from '@nestjs/common';
import { V1Service } from './v1.service';
import { V1Controller } from './v1.controller';
import { UsersModule } from './users/users.module';
import { PollsModule } from './polls/polls.module';
import { RoomsModule } from './rooms/rooms.module';
import { HashtagsModule } from './hashtags/hashtags.module';

@Module({
  controllers: [V1Controller],
  providers: [V1Service],
  imports: [UsersModule, PollsModule, RoomsModule, HashtagsModule],
})
export class V1Module {}
