import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { AuthService } from './auth.service';
import { Auth } from './interfaces/auth.interface';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post()
  async create(@Body() createAuthDto: CreateAuthDto) {
    this.authService.create(createAuthDto);
  }

  @Get()
  async findAll(): Promise<Auth[]> {
    return this.authService.findAll();
  }
}
