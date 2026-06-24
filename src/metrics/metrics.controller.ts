import { Controller, Get, Post, Body } from '@nestjs/common';
import { CreateMetricDto } from './dto/create-metric.dto';
import { MetricsService } from './metrics.service';
import { Metric } from './interfaces/metric.interface';

@Controller('metrics')
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Post()
  async create(@Body() createMetricDto: CreateMetricDto) {
    this.metricsService.create(createMetricDto);
  }

  @Get()
  async findAll(): Promise<Metric[]> {
    return this.metricsService.findAll();
  }
}
