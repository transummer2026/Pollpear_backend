import { Logger, PipeTransform } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ZodSchema } from 'zod';
import { formatZodIssues } from '../format-zod-issues';
import { payloadPreview } from '../payload-preview';

/**
 * Websocket counterpart of ZodValidationPipe. Nest converts anything
 * that is not a WsException into a generic Internal server error on the
 * client exception event, so the HTTP pipe (BadRequestException) cannot
 * be reused here. The refused payload and zod issues are logged server
 * side, the client only gets the short reason.
 */
export class WsZodValidationPipe implements PipeTransform {
  private readonly logger = new Logger(WsZodValidationPipe.name);

  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      this.logger.warn(
        `Invalid payload (${formatZodIssues(result.error)}) payload ${payloadPreview(value)}`,
      );
      throw new WsException('Invalid payload');
    }
    return result.data;
  }
}
