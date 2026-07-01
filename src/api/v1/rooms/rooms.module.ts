import { Module } from '@nestjs/common';
import { ApiRoomsService } from './rooms.service';
import { ApiRoomsController } from './rooms.controller';

@Module({
  controllers: [ApiRoomsController],
  providers: [ApiRoomsService],
})
export class ApiRoomsModule {}
