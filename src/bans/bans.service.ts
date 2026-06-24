import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBanDto } from './dto/create-ban.dto';

@Injectable()
export class BansService {
  constructor(private readonly prisma: PrismaService) {}

  create(createBanDto: CreateBanDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateBanDto: Partial<CreateBanDto>) {}

  remove(id: string) {}
}
