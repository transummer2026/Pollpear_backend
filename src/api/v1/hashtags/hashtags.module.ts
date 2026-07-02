import { Module } from '@nestjs/common';
import { ApiHashtagsService } from './hashtags.service';
import { ApiHashtagsController } from './hashtags.controller';

@Module({
  controllers: [ApiHashtagsController],
  providers: [ApiHashtagsService],
})
export class ApiHashtagsModule {}
