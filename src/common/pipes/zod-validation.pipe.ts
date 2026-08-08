import { Logger, PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { formatZodIssues } from '../format-zod-issues';

export class ZodValidationPipe implements PipeTransform {
  private readonly logger = new Logger(ZodValidationPipe.name);

  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      this.logger.warn(`Invalid payload (${formatZodIssues(result.error)})`);
      throw new BadRequestException('Validation failed');
    }
    return result.data;
  }
}
