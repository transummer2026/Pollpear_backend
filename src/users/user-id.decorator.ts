import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const UserId = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { userId: string }>();
    return request.userId;
  },
);
