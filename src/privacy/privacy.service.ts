import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePrivacyDto } from './dto/create-privacy.dto';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPrivacyDto: CreatePrivacyDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updatePrivacyDto: Partial<CreatePrivacyDto>) {}

  remove(id: string) {}
}
