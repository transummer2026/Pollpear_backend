import { Module } from '@nestjs/common';
import { V1Service } from './v1.service';
import { V1Controller } from './v1.controller';
import { RegisterModule } from './register/register.module';
import { KeysModule } from './keys/keys.module';
import { PollsModule } from './polls/polls.module';
import { HashtagsModule } from './hashtags/hashtags.module';
import { RoomsModule } from './rooms/rooms.module';
import { UsersModule } from './users/users.module';

@Module({
  controllers: [V1Controller],
  providers: [V1Service],
  imports: [RegisterModule, KeysModule, PollsModule, HashtagsModule, RoomsModule, UsersModule],
})
export class V1Module {}
