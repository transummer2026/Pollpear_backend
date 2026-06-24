import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCatDto } from './dto/create-cat.dto';

@Injectable()
export class CatsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createCatDto: CreateCatDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateCatDto: Partial<CreateCatDto>) {}

  remove(id: string) {}
}
