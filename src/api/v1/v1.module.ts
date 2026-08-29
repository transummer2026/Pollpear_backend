import { Module } from '@nestjs/common';
import { ApiV1Service } from './v1.service';
import { ApiV1Controller } from './v1.controller';
import { ApiUsersModule } from './users/users.module';
import { ApiMeModule } from './me/me.module';

@Module({
  controllers: [ApiV1Controller],
  providers: [ApiV1Service],
  imports: [ApiUsersModule, ApiMeModule],
})
export class ApiV1Module {}
