import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreatePollDto } from './dto/create-poll.dto';
import { PollsService } from './polls.service';
import { Poll } from './interfaces/poll.interface';

@Controller('polls')
export class PollsController {
  constructor(private pollsService: PollsService) {}

  @Post()
  async create(@Body() createPollDto: CreatePollDto) {
    this.pollsService.create(createPollDto);
  }

  @Get()
  async findAll(): Promise<Poll[]> {
    return this.pollsService.findAll();
  }
}
