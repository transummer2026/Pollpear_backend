import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreateBanDto } from './dto/create-ban.dto';
import { BansService } from './bans.service';
import { Ban } from './interfaces/ban.interface';

@Controller('bans')
export class BansController {
  constructor(private bansService: BansService) {}

  @Post()
  async create(@Body() createBanDto: CreateBanDto) {
    this.bansService.create(createBanDto);
  }

  @Get()
  async findAll(): Promise<Ban[]> {
    return this.bansService.findAll();
  }
}
