import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSecretDto } from './dto/create-secret.dto';

@Injectable()
export class SecretsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createSecretDto: CreateSecretDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateSecretDto: Partial<CreateSecretDto>) {}

  remove(id: string) {}
}
