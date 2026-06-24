import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreateFeedDto } from './dto/create-feed.dto';
import { FeedService } from './feed.service';
import { Feed } from './interfaces/feed.interface';

@Controller('feed')
export class FeedController {
  constructor(private feedService: FeedService) {}

  @Post()
  async create(@Body() createFeedDto: CreateFeedDto) {
    this.feedService.create(createFeedDto);
  }

  @Get()
  async findAll(): Promise<Feed[]> {
    return this.feedService.findAll();
  }
}
