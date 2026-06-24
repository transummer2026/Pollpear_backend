import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserDto: CreateUserDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateUserDto: Partial<CreateUserDto>) {}

  remove(id: string) {}
}
