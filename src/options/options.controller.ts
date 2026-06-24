import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreateOptionDto } from './dto/create-option.dto';
import { OptionsService } from './options.service';
import { Option } from './interfaces/option.interface';

@Controller('options')
export class OptionsController {
  constructor(private optionsService: OptionsService) {}

  @Post()
  async create(@Body() createOptionDto: CreateOptionDto) {
    this.optionsService.create(createOptionDto);
  }

  @Get()
  async findAll(): Promise<Option[]> {
    return this.optionsService.findAll();
  }
}
