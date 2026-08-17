import { Controller, Get, Param, ParseIntPipe, HttpCode } from '@nestjs/common';
import { ApiHashtagsService } from './hashtags.service';

@Controller('v1/hashtags')
export class ApiHashtagsController {
  constructor(private readonly hashtagsService: ApiHashtagsService) {}

  @Get()
  @HttpCode(503)
  findAllHashtags() {
    return this.hashtagsService.findAllHashtags();
  }

  @Get(':id')
  @HttpCode(503)
  findOneHashtag(@Param('id', ParseIntPipe) id: number) {
    return this.hashtagsService.findOneHashtag(id);
  }
}
