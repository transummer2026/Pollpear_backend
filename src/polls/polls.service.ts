import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePollDto } from './dto/create-poll.dto';

@Injectable()
export class PollsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPollDto: CreatePollDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updatePollDto: Partial<CreatePollDto>) {}

  remove(id: string) {}
}
