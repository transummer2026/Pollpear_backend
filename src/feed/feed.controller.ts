import { Controller, Get, HttpCode } from '@nestjs/common';
import { FeedService } from './feed.service';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @HttpCode(503)
  feed() {
    return this.feedService.feed();
  }

}
