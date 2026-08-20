import { Module } from '@nestjs/common';
import { ApiV1Service } from './v1.service';
import { ApiV1Controller } from './v1.controller';
import { ApiPollsModule } from './polls/polls.module';
import { ApiHashtagsModule } from './hashtags/hashtags.module';
import { ApiRoomsModule } from './rooms/rooms.module';
import { ApiUsersModule } from './users/users.module';
import { ApiMeModule } from './me/me.module';

@Module({
  controllers: [ApiV1Controller],
  providers: [ApiV1Service],
  imports: [
    ApiPollsModule,
    ApiHashtagsModule,
    ApiRoomsModule,
    ApiUsersModule,
    ApiMeModule,
  ],
})
export class ApiV1Module {}
