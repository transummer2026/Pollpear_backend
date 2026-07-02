import { Module } from '@nestjs/common';
import { ApiPollsService } from './polls.service';
import { ApiPollsController } from './polls.controller';

@Module({
  controllers: [ApiPollsController],
  providers: [ApiPollsService],
})
export class ApiPollsModule {}
