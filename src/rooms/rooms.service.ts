import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createRoomDto: CreateRoomDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateRoomDto: Partial<CreateRoomDto>) {}

  remove(id: string) {}
}
