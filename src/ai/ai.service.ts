import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAiDto } from './dto/create-ai.dto';

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAiDto: CreateAiDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateAiDto: Partial<CreateAiDto>) {}

  remove(id: string) {}
}
