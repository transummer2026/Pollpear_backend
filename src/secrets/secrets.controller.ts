import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreateSecretDto } from './dto/create-secret.dto';
import { SecretsService } from './secrets.service';
import { Secret } from './interfaces/secret.interface';

@Controller('secrets')
export class SecretsController {
  constructor(private secretsService: SecretsService) {}

  @Post()
  async create(@Body() createSecretDto: CreateSecretDto) {
    this.secretsService.create(createSecretDto);
  }

  @Get()
  async findAll(): Promise<Secret[]> {
    return this.secretsService.findAll();
  }
}
