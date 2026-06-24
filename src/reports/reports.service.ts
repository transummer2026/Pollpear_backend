import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createReportDto: CreateReportDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateReportDto: Partial<CreateReportDto>) {}

  remove(id: string) {}
}
