import { BadRequestException, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(
    z.object({
      pollId: z.number().int().positive(),
      title: z.string().trim().min(1),
    }),
  );

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it('returns the parsed payload, transforms applied', () => {
    const parsed = pipe.transform({ pollId: 7, title: '  hello  ' });

    expect(parsed).toEqual({ pollId: 7, title: 'hello' });
  });

  it('rejects an invalid payload with a BadRequestException', () => {
    expect(() => pipe.transform({ pollId: 'x', title: 'hello' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a non-object payload', () => {
    expect(() => pipe.transform(null)).toThrow(BadRequestException);
  });

  it('keeps the zod issue details out of the response', () => {
    let caught: BadRequestException | undefined;

    try {
      pipe.transform({ pollId: 'x', title: '' });
    } catch (error) {
      caught = error as BadRequestException;
    }

    expect(caught?.getResponse()).toEqual({
      error: 'Bad Request',
      message: 'Validation failed',
      statusCode: 400,
    });
  });
});
