import { Controller, Get, Param, ParseIntPipe, HttpCode } from '@nestjs/common';
import { HashtagsService } from './hashtags.service';

@Controller('hashtags')
export class HashtagsController {
  constructor(private readonly hashtagsService: HashtagsService) {}

  @Get('hashtags')
  @HttpCode(503)
  findAllHashtags() {
    return this.hashtagsService.findAllHashtags();
  }

  @Get('hashtags/:id')
  @HttpCode(503)
  findOneHashtag(@Param('id', ParseIntPipe) id: number) {
    return this.hashtagsService.findOneHashtag(id);
  }
}
