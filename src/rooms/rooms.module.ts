import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomsWsController } from './rooms.controller-ws';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, RoomsWsController],
})
export class RoomsModule {}
