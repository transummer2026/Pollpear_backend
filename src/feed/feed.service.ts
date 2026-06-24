import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeedDto } from './dto/create-feed.dto';

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  create(createFeedDto: CreateFeedDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateFeedDto: Partial<CreateFeedDto>) {}

  remove(id: string) {}
}
