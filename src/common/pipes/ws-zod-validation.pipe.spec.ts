import { WsException } from '@nestjs/websockets';
import { z } from 'zod';
import { WsZodValidationPipe } from './ws-zod-validation.pipe';

describe('WsZodValidationPipe', () => {
  const pipe = new WsZodValidationPipe(
    z.object({
      roomId: z.number().int().positive(),
      content: z.string().trim().min(1),
    }),
  );

  it('returns the parsed payload, transforms applied', () => {
    expect(pipe.transform({ roomId: 1, content: '  hello  ' })).toEqual({
      roomId: 1,
      content: 'hello',
    });
  });

  it('throws a WsException on an invalid payload', () => {
    expect(() => pipe.transform({ roomId: 'x', content: 'hello' })).toThrow(
      WsException,
    );
  });

  it('throws a WsException on a non-object payload', () => {
    expect(() => pipe.transform(null)).toThrow(WsException);
  });
});
