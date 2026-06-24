import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createMessageDto: CreateMessageDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateMessageDto: Partial<CreateMessageDto>) {}

  remove(id: string) {}
}
