import { Body, Param, Query } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { ApiIdParamSchema } from './schemas/api-params.schema';

/**
 * The :id of a route, validated the same way everywhere. Its swagger
 * counterpart stays separate as ApiIdParamDocs: one decorates the parameter,
 * the other the handler, so they cannot be merged into a single decorator.
 */
export const IdParam = () =>
  Param('id', new ZodValidationPipe(ApiIdParamSchema));

export const ValidatedBody = (schema: ZodType) =>
  Body(new ZodValidationPipe(schema));

export const ValidatedQuery = (schema: ZodType) =>
  Query(new ZodValidationPipe(schema));
