import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 1. Grab the user ID from the headers (always use lowercase keys here)
    const rawUserId = req.headers['x-user-id'];

    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    if (userId) {
      console.log(`[Logger] Request made by User ID: ${userId}`);
    } else {
      console.log(`[Logger] Request made by anonymous Guest`);
    }

    // 2. Don't forget to call your function pointer to pass control to the next step!
    next();
  }
}
