import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHashtagDto } from './dto/create-hashtag.dto';

@Injectable()
export class HashtagsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createHashtagDto: CreateHashtagDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateHashtagDto: Partial<CreateHashtagDto>) {}

  remove(id: string) {}
}
