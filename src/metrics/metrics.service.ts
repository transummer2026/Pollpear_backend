import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMetricDto } from './dto/create-metric.dto';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createMetricDto: CreateMetricDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateMetricDto: Partial<CreateMetricDto>) {}

  remove(id: string) {}
}
