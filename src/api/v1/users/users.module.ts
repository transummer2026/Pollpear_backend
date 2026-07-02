import { Module } from '@nestjs/common';
import { ApiUsersService } from './users.service';
import { ApiUsersController } from './users.controller';

@Module({
  controllers: [ApiUsersController],
  providers: [ApiUsersService],
})
export class ApiUsersModule {}
