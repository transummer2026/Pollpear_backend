import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLegalDto } from './dto/create-legal.dto';

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  create(createLegalDto: CreateLegalDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateLegalDto: Partial<CreateLegalDto>) {}

  remove(id: string) {}
}
