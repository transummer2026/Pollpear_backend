import { Module } from '@nestjs/common';
import { ApiV1Service } from './v1.service';
import { ApiV1Controller } from './v1.controller';
import { ApiRegisterModule } from './register/register.module';
import { ApiKeysModule } from './keys/keys.module';
import { ApiPollsModule } from './polls/polls.module';
import { ApiHashtagsModule } from './hashtags/hashtags.module';
import { ApiRoomsModule } from './rooms/rooms.module';
import { ApiUsersModule } from './users/users.module';

@Module({
  controllers: [ApiV1Controller],
  providers: [ApiV1Service],
  imports: [
    ApiRegisterModule,
    ApiKeysModule,
    ApiPollsModule,
    ApiHashtagsModule,
    ApiRoomsModule,
    ApiUsersModule,
  ],
})
export class ApiV1Module {}
