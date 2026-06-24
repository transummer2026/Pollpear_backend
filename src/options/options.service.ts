import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOptionDto } from './dto/create-option.dto';

@Injectable()
export class OptionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createOptionDto: CreateOptionDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateOptionDto: Partial<CreateOptionDto>) {}

  remove(id: string) {}
}
