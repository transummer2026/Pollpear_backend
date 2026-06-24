import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreateAiDto } from './dto/create-ai.dto';
import { AiService } from './ai.service';
import { Ai } from './interfaces/ai.interface';

@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post()
  async create(@Body() createAiDto: CreateAiDto) {
    this.aiService.create(createAiDto);
  }

  @Get()
  async findAll(): Promise<Ai[]> {
    return this.aiService.findAll();
  }
}
