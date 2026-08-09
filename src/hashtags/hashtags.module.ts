import { Module } from '@nestjs/common';
import { HashtagsService } from './hashtags.service';

@Module({
  providers: [HashtagsService],
  exports: [HashtagsService],
})
export class HashtagsModule {}
