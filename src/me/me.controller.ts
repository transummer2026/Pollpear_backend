import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreateMeDto } from './dto/create-me.dto';
import { MeService } from './me.service';
import { Me } from './interfaces/me.interface';

@Controller('me')
export class MeController {
  constructor(private meService: MeService) {}

  @Post()
  async create(@Body() createMeDto: CreateMeDto) {
    this.meService.create(createMeDto);
  }

  @Get()
  async findAll(): Promise<Me[]> {
    return this.meService.findAll();
  }
}
