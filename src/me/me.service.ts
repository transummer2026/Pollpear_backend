import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMeDto } from './dto/create-me.dto';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  create(createMeDto: CreateMeDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateMeDto: Partial<CreateMeDto>) {}

  remove(id: string) {}
}
