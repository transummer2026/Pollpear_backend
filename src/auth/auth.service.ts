import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAuthDto } from './dto/create-auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAuthDto: CreateAuthDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateAuthDto: Partial<CreateAuthDto>) {}

  remove(id: string) {}
}
