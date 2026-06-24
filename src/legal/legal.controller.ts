import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreateLegalDto } from './dto/create-legal.dto';
import { LegalService } from './legal.service';
import { Legal } from './interfaces/legal.interface';

@Controller('legal')
export class LegalController {
  constructor(private legalService: LegalService) {}

  @Post()
  async create(@Body() createLegalDto: CreateLegalDto) {
    this.legalService.create(createLegalDto);
  }

  @Get()
  async findAll(): Promise<Legal[]> {
    return this.legalService.findAll();
  }
}
