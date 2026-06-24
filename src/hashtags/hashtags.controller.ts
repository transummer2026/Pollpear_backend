import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreateHashtagDto } from './dto/create-hashtag.dto';
import { HashtagsService } from './hashtags.service';
import { Hashtag } from './interfaces/hashtag.interface';

@Controller('hashtags')
export class HashtagsController {
  constructor(private hashtagsService: HashtagsService) {}

  @Post()
  async create(@Body() createHashtagDto: CreateHashtagDto) {
    this.hashtagsService.create(createHashtagDto);
  }

  @Get()
  async findAll(): Promise<Hashtag[]> {
    return this.hashtagsService.findAll();
  }
}
