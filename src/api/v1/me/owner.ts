import { Logger, UnauthorizedException } from '@nestjs/common';
import { isMissingRecord } from '../common/prisma-errors';

export function ownerIsGone(
  logger: Logger,
  ownerId: number,
): UnauthorizedException {
  logger.warn(`api key of deleted or unknown user ${ownerId} used`);
  return new UnauthorizedException('Invalid credentials');
}

export function rejectWhenOwnerIsGone(logger: Logger, ownerId: number) {
  return (error: unknown): never => {
    throw isMissingRecord(error) ? ownerIsGone(logger, ownerId) : error;
  };
}
