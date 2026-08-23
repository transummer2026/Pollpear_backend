// src/api/v1/common/params.ts
import { Body, Param, Query } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { ApiIdParamSchema } from './schemas/api-params.schema';

export const IdParam = () =>
  Param('id', new ZodValidationPipe(ApiIdParamSchema));

export const ValidatedBody = (schema: ZodType) =>
  Body(new ZodValidationPipe(schema));

export const ValidatedQuery = (schema: ZodType) =>
  Query(new ZodValidationPipe(schema));
