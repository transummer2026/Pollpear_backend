import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreatePrivacyDto } from './dto/create-privacy.dto';
import { PrivacyService } from './privacy.service';
import { Privacy } from './interfaces/privacy.interface';

@Controller('privacy')
export class PrivacyController {
  constructor(private privacyService: PrivacyService) {}

  @Post()
  async create(@Body() createPrivacyDto: CreatePrivacyDto) {
    this.privacyService.create(createPrivacyDto);
  }

  @Get()
  async findAll(): Promise<Privacy[]> {
    return this.privacyService.findAll();
  }
}
