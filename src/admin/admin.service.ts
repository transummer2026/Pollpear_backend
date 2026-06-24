import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAdminDto: CreateAdminDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateAdminDto: Partial<CreateAdminDto>) {}

  remove(id: string) {}
}
